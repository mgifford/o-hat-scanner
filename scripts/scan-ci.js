import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import fs from 'fs';
import path from 'path';
import { parseStringPromise } from 'xml2js';
import * as cheerio from 'cheerio';
import { validateSchema, createEmptyResult } from './shared-schema.js';

// Configuration
const MAX_PAGES = parseInt(process.env.INPUT_MAX_PAGES || '50', 10);
const TIMEOUT_MS = parseInt(process.env.INPUT_TIMEOUT_MS || '30000', 10);
const CONCURRENCY = parseInt(process.env.INPUT_CONCURRENCY || '2', 10);
const DISCOVER = process.env.DISCOVER === 'true'; // Set to true to enable discovery for raw URLs
const USER_AGENT = process.env.INPUT_USER_AGENT || 'a11y-dual-scanner/1.0';
const MODE = process.env.INPUT_MODE || 'sitemap'; // sitemap | crawl | list
const LABEL = process.env.INPUT_LABEL || '';
const BASE_URL = process.env.INPUT_BASE_URL || '';

// Input URLs (newline separated)
const RAW_URLS = process.env.INPUT_URLS || ''; 

async function main() {
    let urls = RAW_URLS.split('\n').map(u => u.trim()).filter(u => u);

    if (MODE !== 'list' && BASE_URL) {
        urls.unshift(BASE_URL);
    }

    // Legacy/Manual fallback: Check targets.txt if no env provided
    if (urls.length === 0) {
        try {
            const targetsPath = path.join(process.cwd(), 'targets.txt');
            if (fs.existsSync(targetsPath)) {
                console.log('Reading URLs from targets.txt');
                const fileContent = fs.readFileSync(targetsPath, 'utf-8');
                urls = fileContent.split('\n').map(u => u.trim()).filter(u => u && !u.startsWith('#'));
            }
        } catch (e) {
            console.error('Error reading targets.txt:', e);
        }
    }
    
    if (urls.length === 0) {
        console.log('No URLs provided. Set INPUT_URLS env var, INPUT_BASE_URL, or add to targets.txt.');
        // For testing locally without env var
        if (process.argv[2]) {
             urls.push(process.argv[2]);
        } else {
             return;
        }
    }

    console.log(`Starting scan with config: MODE=${MODE}, MAX_PAGES=${MAX_PAGES}, CONCURRENCY=${CONCURRENCY}, LABEL=${LABEL || 'none'}`);
    // Helpful debug log: show final list of URLs that will be scanned
    console.log('Final targets to scan:', JSON.stringify(urls, null, 2));

    const runResult = createEmptyResult('ci', { 
        maxPages: MAX_PAGES, 
        timeout: TIMEOUT_MS,
        concurrency: CONCURRENCY,
        mode: MODE,
        baseUrl: BASE_URL || null
    }, urls, LABEL);

    const browser = await chromium.launch();
    const context = await browser.newContext({ userAgent: USER_AGENT });

    // Queue of URLs to scan
    let scanQueue = new Set();
    const visited = new Set();

    // 1. Discovery Phase
    if (MODE === 'list') {
        urls.forEach(u => {
            const target = normalizeUrl(u);
            if (target) scanQueue.add(target);
        });
    } else {
        for (const inputUrl of urls) {
            const target = normalizeUrl(inputUrl);
            if (!target) continue;

            try {
                const urlObj = new URL(target);

                if (MODE === 'crawl') {
                    scanQueue.add(urlObj.toString());
                    continue;
                }

                // MODE === 'sitemap'
                if (urlObj.pathname.endsWith('.xml')) {
                    console.log(`Processing sitemap: ${target}`);
                    const sitemapUrls = await fetchSitemap(target);
                    if (sitemapUrls.length > 0) {
                        console.log(`Found ${sitemapUrls.length} URLs in sitemap.`);
                        sitemapUrls.forEach(u => scanQueue.add(u));
                    } else {
                        console.log(`No URLs found in sitemap: ${target}`);
                    }
                } else {
                    const sitemapUrl = new URL('/sitemap.xml', urlObj.origin).toString();
                    console.log(`Checking for default sitemap at ${sitemapUrl}...`);
                    const sitemapUrls = await fetchSitemap(sitemapUrl);
                    if (sitemapUrls.length > 0) {
                        console.log(`Found ${sitemapUrls.length} URLs in sitemap.`);
                        sitemapUrls.forEach(u => scanQueue.add(u));
                    } else {
                        console.log('No sitemap found. Adding root to scan queue.');
                        if (!visited.has(target)) scanQueue.add(target);
                    }
                }
            } catch (e) {
                console.error(`Invalid URL ${inputUrl}: ${e.message}`);
            }
        }
    }

    // Convert Set to Array for processing
    let queueArray = Array.from(scanQueue);
    let results = {};

    // 2. Scanning Phase
    let processedCount = 0;
    
    // Simple batch processor
    while (queueArray.length > 0 && processedCount < MAX_PAGES) {
        const batch = queueArray.splice(0, CONCURRENCY);
        
        await Promise.all(batch.map(async (url) => {
            if (visited.has(url) || processedCount >= MAX_PAGES) return;
            visited.add(url);
            processedCount++;

            console.log(`Scanning [${processedCount}/${MAX_PAGES}] ${url}...`);
            
            try {
                const result = await scanPage(context, url, visited, queueArray);
                results[url] = result;
            } catch (err) {
                console.error(`Error scanning ${url}:`, err);
                results[url] = { 
                    violations: [], 
                    error: err.message 
                };
            }
        }));

        // If we need to discover more pages and we haven't hit limit
        // (New links are added to queueArray during scanPage if DISCOVER logic implies it - currently just sitemap logic or root crawling)
        // Implementing generic crawling for CI if sitemap failed:
        if (queueArray.length === 0 && processedCount < MAX_PAGES) {
             // Logic for further crawling could go here if we wanted to crawl *discovered* links
             // For this implementation, we simply consume the discovered links from sitemap or input
        }
    }

    await browser.close();

    runResult.finishedAt = new Date().toISOString();
    runResult.resultsByUrl = results;

    // Save outputs
    const runDir = path.join('site', 'runs', runResult.runId);
    fs.mkdirSync(runDir, { recursive: true });
    
    fs.writeFileSync(path.join(runDir, 'results.json'), JSON.stringify(runResult, null, 2));
    
    // Create summary
    const summary = {
        runId: runResult.runId,
        startedAt: runResult.startedAt,
        pagesScanned: Object.keys(results).length,
        pagesWithViolations: Object.values(results).filter(r => r.violations && r.violations.length > 0).length,
        totalViolations: Object.values(results).reduce((acc, r) => acc + (r.violations ? r.violations.reduce((sum, v) => sum + v.nodes.length, 0) : 0), 0)
    };
    
    fs.writeFileSync(path.join(runDir, 'summary.json'), JSON.stringify(summary, null, 2));
    
    console.log(`Run ${runResult.runId} complete. Results saved.`);
}

async function fetchSitemap(url) {
    try {
        const resp = await fetch(url);
        if (!resp.ok) return [];
        const text = await resp.text();
        const result = await parseStringPromise(text);
        
        let urls = [];
        // Handle sitemap index (recursive)
        if (result.sitemapindex && result.sitemapindex.sitemap) {
             const childSitemaps = result.sitemapindex.sitemap.map(s => s.loc[0]);
             console.log(`Found sitemap index with ${childSitemaps.length} sitemaps. Fetching...`);
             for (const childUrl of childSitemaps) {
                 const childUrls = await fetchSitemap(childUrl);
                 urls = urls.concat(childUrls);
             }
        }
        if (result.urlset && result.urlset.url) {
            urls = result.urlset.url.map(u => u.loc[0]);
        }
        return urls;
    } catch (e) {
        console.error(`Sitemap fetch failed for ${url}: ${e.message}`);
        return [];
    }
}

async function scanPage(context, url, visited, queue) {
    const page = await context.newPage();
    let axeResults = null;
    let error = null;
    let title = '';

    try {
        await page.goto(url, { timeout: TIMEOUT_MS, waitUntil: 'domcontentloaded' });
        title = await page.title();
        
        // Crawl if queuing is active and mode allows discovery
        if (MODE === 'crawl' && queue.length < MAX_PAGES) {
             const links = await page.$$eval('a', as => as.map(a => a.href));
             // Filter internal, not visited
             const origin = new URL(url).origin;
             
             for (const link of links) {
                 try {
                    const linkUrl = new URL(link);
                    // normalize by removing hash
                    linkUrl.hash = '';
                    const cleanLink = linkUrl.toString();
                    
                    if (linkUrl.origin === origin && !visited.has(cleanLink) && !queue.includes(cleanLink)) {
                         queue.push(cleanLink);
                    }
                 } catch(e) {}
             }
        }

        const results = await new AxeBuilder({ page }).analyze();
        axeResults = results;
    } catch (e) {
        error = e.message;
    } finally {
        await page.close();
    }

    return {
        title: title,
        violations: axeResults ? axeResults.violations : [],
        passes: axeResults ? axeResults.passes : [],
        incomplete: axeResults ? axeResults.incomplete : [],
        error: error
    };
}

function normalizeUrl(input) {
    if (!input) return '';
    let target = input.trim();
    if (!target) return '';
    if (!/^https?:\/\//i.test(target)) target = 'https://' + target;
    return target;
}

main().catch(console.error);
