import { chromium, firefox, webkit } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import fs from 'fs';
import path from 'path';
import { parseStringPromise } from 'xml2js';
import * as cheerio from 'cheerio';
import { validateSchema, createEmptyResult } from './shared-schema.js';

// Configuration
const REQUESTED_MAX = parseInt(process.env.INPUT_MAX_PAGES || '50', 10);
const MAX_PAGES = Math.min(Math.max(REQUESTED_MAX, 1), 200); // clamp to [1, 200]
const TIMEOUT_MS = parseInt(process.env.INPUT_TIMEOUT_MS || '30000', 10);
const CONCURRENCY = parseInt(process.env.INPUT_CONCURRENCY || '2', 10);
const DISCOVER = process.env.DISCOVER === 'true'; // Set to true to enable discovery for raw URLs
const USER_AGENT = process.env.INPUT_USER_AGENT || 'a11y-dual-scanner/1.0';
const MODE = process.env.INPUT_MODE || 'sitemap'; // sitemap | crawl | list
const LABEL = process.env.INPUT_LABEL || '';
const BASE_URL = process.env.INPUT_BASE_URL || '';
const VIEWPORT_PROFILE = process.env.INPUT_VIEWPORT_PROFILE || 'desktop'; // desktop | mobile
const COLOR_SCHEME = process.env.INPUT_COLOR_SCHEME || 'light'; // light | dark
const SITEMAP_SAMPLE_STRATEGY = (process.env.INPUT_SITEMAP_SAMPLE_STRATEGY || 'shuffle').toLowerCase(); // shuffle | sequential
const SITEMAP_SAMPLE_SEED = process.env.INPUT_SITEMAP_SAMPLE_SEED || '';
const SKIP_EXTENSIONS = (process.env.INPUT_SKIP_EXTENSIONS || '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.gz,.tgz,.tar,.rar,.7z').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
const SITEMAP_FALLBACK_TO_CRAWL = process.env.INPUT_SITEMAP_FALLBACK_TO_CRAWL !== 'false';
const BROWSER_NAME = normalizeBrowserName(process.env.INPUT_BROWSER || 'chromium'); // chromium | firefox | webkit

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

    if (REQUESTED_MAX > MAX_PAGES) {
        console.log(`Requested max pages ${REQUESTED_MAX} exceeds cap; clamped to ${MAX_PAGES}`);
    }
    const resolvedSeed = resolveSitemapSeed({ providedSeed: SITEMAP_SAMPLE_SEED, label: LABEL, baseUrl: BASE_URL });
    console.log(`Starting scan with config: MODE=${MODE}, MAX_PAGES=${MAX_PAGES}, CONCURRENCY=${CONCURRENCY}, LABEL=${LABEL || 'none'}, VIEWPORT=${VIEWPORT_PROFILE}, COLOR=${COLOR_SCHEME}, BROWSER=${BROWSER_NAME}`);
    console.log('Scan inputs:', JSON.stringify({
        mode: MODE,
        maxPages: MAX_PAGES,
        timeoutMs: TIMEOUT_MS,
        concurrency: CONCURRENCY,
        label: LABEL || null,
        baseUrl: BASE_URL || null,
        viewport: VIEWPORT_PROFILE,
        colorScheme: COLOR_SCHEME,
        browser: BROWSER_NAME,
        sitemapSample: { strategy: SITEMAP_SAMPLE_STRATEGY, seed: resolvedSeed, size: MAX_PAGES },
        userAgent: USER_AGENT,
        skipExtensions: SKIP_EXTENSIONS,
        crawlFallback: SITEMAP_FALLBACK_TO_CRAWL
    }, null, 2));
    // Helpful debug log: show final list of URLs that will be scanned
    console.log('Final targets to scan:', JSON.stringify(urls, null, 2));

    const runResult = createEmptyResult('ci', { 
        maxPages: MAX_PAGES, 
        timeout: TIMEOUT_MS,
        concurrency: CONCURRENCY,
        mode: MODE,
        baseUrl: BASE_URL || null,
        viewport: VIEWPORT_PROFILE,
        colorScheme: COLOR_SCHEME,
        sitemapSample: {
            strategy: SITEMAP_SAMPLE_STRATEGY,
            seed: resolvedSeed || null,
            size: MAX_PAGES
        },
        crawlFallback: {
            enabled: SITEMAP_FALLBACK_TO_CRAWL,
            used: false
        },
        browser: BROWSER_NAME
    }, urls, LABEL);

    const browserType = selectBrowser(BROWSER_NAME);
    const browser = await browserType.launch();
    const context = await browser.newContext({ 
        userAgent: USER_AGENT,
        colorScheme: COLOR_SCHEME === 'dark' ? 'dark' : 'light',
        viewport: VIEWPORT_PROFILE === 'mobile' ? { width: 390, height: 844 } : { width: 1280, height: 720 },
        isMobile: VIEWPORT_PROFILE === 'mobile',
        deviceScaleFactor: VIEWPORT_PROFILE === 'mobile' ? 3 : 1,
        hasTouch: VIEWPORT_PROFILE === 'mobile'
    });

    // Queue of URLs to scan
    let scanQueue = new Set();
    const visited = new Set();
    let crawlFallbackUsed = false;

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
                    const sitemapUrls = await fetchSitemap(target, {
                        maxPages: MAX_PAGES,
                        strategy: SITEMAP_SAMPLE_STRATEGY,
                        seed: resolveSitemapSeed({ providedSeed: SITEMAP_SAMPLE_SEED, label: LABEL, baseUrl: BASE_URL, urlObj })
                    });
                    if (sitemapUrls.length > 0) {
                        console.log(`Found ${sitemapUrls.length} URLs in sitemap.`);
                        sitemapUrls.forEach(u => scanQueue.add(u));
                    } else {
                        console.log(`No URLs found in sitemap: ${target}`);
                        if (SITEMAP_FALLBACK_TO_CRAWL) {
                            console.log('Falling back to crawl mode for this target.');
                            crawlFallbackUsed = true;
                            if (!visited.has(target)) scanQueue.add(target);
                        }
                    }
                } else {
                    const sitemapUrl = new URL('/sitemap.xml', urlObj.origin).toString();
                    console.log(`Checking for default sitemap at ${sitemapUrl}...`);
                    const sitemapUrls = await fetchSitemap(sitemapUrl, {
                        maxPages: MAX_PAGES,
                        strategy: SITEMAP_SAMPLE_STRATEGY,
                        seed: resolveSitemapSeed({ providedSeed: SITEMAP_SAMPLE_SEED, label: LABEL, baseUrl: BASE_URL, urlObj })
                    });
                    if (sitemapUrls.length > 0) {
                        console.log(`Found ${sitemapUrls.length} URLs in sitemap.`);
                        sitemapUrls.forEach(u => scanQueue.add(u));
                    } else {
                        console.log('No sitemap found. Adding root to scan queue.');
                        if (!visited.has(target)) scanQueue.add(target);
                        if (SITEMAP_FALLBACK_TO_CRAWL) {
                            crawlFallbackUsed = true;
                            console.log('Crawl fallback enabled for this run.');
                            const discovered = await discoverLinksFromHtml(target, MAX_PAGES - scanQueue.size);
                            if (discovered.length) {
                                console.log(`Discovered ${discovered.length} links from root for crawl fallback.`);
                                discovered.forEach(u => scanQueue.add(u));
                            }
                        }
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

    const allowDiscovery = shouldAllowDiscovery(MODE, crawlFallbackUsed);
    if (crawlFallbackUsed) {
        runResult.config.crawlFallback.used = true;
    }

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
                const result = await scanPage(context, url, visited, queueArray, allowDiscovery);
                const key = result?.finalUrl || url;
                const sources = [];
                if (result?.originalUrl && result.originalUrl !== key) {
                    sources.push(result.originalUrl);
                }
                results[key] = { ...result, sources };
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
        totalViolations: Object.values(results).reduce((acc, r) => acc + (r.violations ? r.violations.reduce((sum, v) => sum + v.nodes.length, 0) : 0), 0),
        target: runResult.config?.baseUrl || (runResult.targets?.[0] || ''),
        mode: runResult.mode,
        viewport: runResult.config?.viewport,
        colorScheme: runResult.config?.colorScheme,
        browser: runResult.config?.browser,
        maxPages: runResult.config?.maxPages,
        sampleStrategy: runResult.config?.sitemapSample?.strategy,
        sampleSeed: runResult.config?.sitemapSample?.seed
    };
    
    fs.writeFileSync(path.join(runDir, 'summary.json'), JSON.stringify(summary, null, 2));
    
    console.log(`Run ${runResult.runId} complete. Results saved.`);
}

async function fetchSitemap(url, options = {}) {
    const maxPages = options.maxPages || MAX_PAGES;
    const strategy = options.strategy || 'shuffle';
    const seed = options.seed || 'sitemap';
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
                 const childUrls = await fetchSitemap(childUrl, { maxPages, strategy, seed });
                 urls = urls.concat(childUrls);
             }
        }
        if (result.urlset && result.urlset.url) {
            let consecutivePdf = 0;
            for (const entry of result.urlset.url) {
                const loc = entry.loc[0];
                if (isPdfLike(loc)) {
                    consecutivePdf += 1;
                    if (consecutivePdf >= 5) {
                        console.log('Skipping remainder of sitemap after 5 pdf-like entries in a row.');
                        break; // jump to next sitemap
                    }
                    continue; // do not include pdf-like URLs
                }
                consecutivePdf = 0;
                urls.push(loc);
            }
        }

        urls = Array.from(new Set(urls)).filter(u => isLikelyHtmlUrl(u));

        const sampled = sampleSitemapUrls(urls, { maxPages, strategy, seed });
        if (sampled.length < urls.length) {
            console.log(`Sampling ${sampled.length} of ${urls.length} URLs from sitemap using ${strategy} (seed=${seed || 'auto'})`);
        }
        return sampled;
    } catch (e) {
        console.error(`Sitemap fetch failed for ${url}: ${e.message}`);
        return [];
    }
}

async function discoverLinksFromHtml(baseUrl, limit = 50) {
    try {
        const resp = await fetch(baseUrl, { headers: { 'User-Agent': USER_AGENT } });
        const ct = (resp.headers.get('content-type') || '').toLowerCase();
        if (!resp.ok || (ct && !ct.includes('text/html'))) return [];
        const html = await resp.text();
        return extractLinks(baseUrl, html).slice(0, limit);
    } catch (e) {
        console.error(`Fallback crawl discovery failed for ${baseUrl}: ${e.message}`);
        return [];
    }
}

function extractLinks(baseUrl, html) {
    if (!html) return [];
    let origin;
    try {
        origin = new URL(baseUrl).origin;
    } catch {
        return [];
    }
    const $ = cheerio.load(html);
    const links = new Set();
    $('a[href]').each((_, el) => {
        const href = $(el).attr('href');
        if (!href) return;
        try {
            const resolved = new URL(href, origin);
            if (resolved.origin !== origin) return;
            resolved.hash = '';
            const clean = resolved.toString();
            if (isLikelyHtmlUrl(clean)) links.add(clean);
        } catch {}
    });
    return Array.from(links);
}

async function scanPage(context, url, visited, queue, allowDiscovery = false) {
    const page = await context.newPage();
    let axeResults = null;
    let error = null;
    let title = '';
    let finalUrl = url;
    let status = null;
    let contentType = '';

    try {
        const response = await page.goto(url, { timeout: TIMEOUT_MS, waitUntil: 'domcontentloaded' });
        if (response) {
            finalUrl = typeof response.url === 'function' ? response.url() : finalUrl;
            status = typeof response.status === 'function' ? response.status() : null;
            const headers = typeof response.headers === 'function' ? response.headers() : {};
            contentType = headers['content-type'] || headers['Content-Type'] || '';
            visited.add(finalUrl);
        }
        title = await page.title();

        const analysisGate = shouldAnalyzeResponse({ status, contentType });
        if (!analysisGate.ok) {
            return {
                title,
                violations: [],
                passes: [],
                incomplete: [],
                error: analysisGate.reason,
                finalUrl,
                originalUrl: url,
                status,
                contentType
            };
        }
        
        // Crawl if queuing is active and mode allows discovery
        if (allowDiscovery && queue.length < MAX_PAGES) {
             const links = await page.$$eval('a', as => as.map(a => a.href));
             // Filter internal, not visited
             const origin = new URL(finalUrl).origin;
             
             for (const link of links) {
                 try {
                    const linkUrl = new URL(link);
                    // normalize by removing hash
                    linkUrl.hash = '';
                    const cleanLink = linkUrl.toString();
                    
                    if (linkUrl.origin === origin && isLikelyHtmlUrl(cleanLink) && !visited.has(cleanLink) && !queue.includes(cleanLink)) {
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
        error: error,
        finalUrl,
        originalUrl: url,
        status,
        contentType
    };
}

function normalizeUrl(input) {
    if (!input) return '';
    let target = input.trim();
    if (!target) return '';
    if (!/^https?:\/\//i.test(target)) target = 'https://' + target;
    return target;
}

function isLikelyHtmlUrl(target) {
    try {
        const url = new URL(target);
        const pathname = (url.pathname || '').toLowerCase();
        const trimmedPath = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
        if (isPdfLike(target)) return false;
        for (const ext of SKIP_EXTENSIONS) {
            if (trimmedPath.endsWith(ext)) return false;
            const bare = ext.startsWith('.') ? ext.slice(1) : ext;
            if (bare && trimmedPath.endsWith(bare)) return false;
        }
        const idx = trimmedPath.lastIndexOf('.');
        if (idx === -1) return true; // no dot extension, assume HTML route
        const ext = trimmedPath.slice(idx);
        if (SKIP_EXTENSIONS.includes(ext)) return false;
        return true;
    } catch {
        return false;
    }
}

function isPdfLike(target) {
    try {
        const url = new URL(target);
        const pathname = (url.pathname || '').toLowerCase();
        if (pathname.endsWith('.pdf')) return true;
        if (pathname.endsWith('pdf')) return true; // handles paths without a dot
        return false;
    } catch {
        return false;
    }
}

function resolveSitemapSeed({ providedSeed, label, baseUrl, urlObj } = {}) {
    if (providedSeed && String(providedSeed).trim()) return String(providedSeed).trim();
    if (label && String(label).trim()) return String(label).trim();
    if (baseUrl && String(baseUrl).trim()) return String(baseUrl).trim();
    if (urlObj && urlObj.hostname) return urlObj.hostname;
    return 'sitemap';
}

function shouldAnalyzeResponse({ status, contentType } = {}) {
    if (typeof status === 'number' && status >= 400) {
        return { ok: false, reason: `HTTP ${status}` };
    }
    const ct = (contentType || '').toLowerCase();
    if (ct && !ct.includes('text/html')) {
        return { ok: false, reason: `Skipped non-HTML content (${contentType})` };
    }
    return { ok: true };
}

function stringToSeed(input) {
    const str = input || 'sitemap';
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
    }
    return hash || 1; // avoid zero seed
}

function mulberry32(seed) {
    let t = seed >>> 0;
    return function() {
        t = (t + 0x6D2B79F5) | 0;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
}

function seededShuffle(list, seed) {
    const arr = list.slice();
    const rand = mulberry32(seed);
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function sampleSitemapUrls(urls, { maxPages, strategy = 'shuffle', seed = 'sitemap' } = {}) {
    if (!Array.isArray(urls)) return [];
    const filtered = urls.filter(isLikelyHtmlUrl);
    const limit = Math.max(0, Math.min(maxPages ?? filtered.length, filtered.length));
    if (limit === 0) return [];
    if (strategy === 'sequential') {
        return filtered.slice(0, limit);
    }
    const seeded = stringToSeed(seed);
    const shuffled = seededShuffle(filtered, seeded);
    return shuffled.slice(0, limit);
}

function selectBrowser(name) {
    const normalized = normalizeBrowserName(name);
    if (normalized === 'firefox') return firefox;
    if (normalized === 'webkit') return webkit;
    return chromium;
}

function normalizeBrowserName(name = 'chromium') {
    const val = String(name).toLowerCase();
    if (val === 'firefox') return 'firefox';
    if (val === 'webkit' || val === 'safari') return 'webkit';
    return 'chromium';
}

function shouldAllowDiscovery(mode, crawlFallbackUsed) {
    return mode === 'crawl' || crawlFallbackUsed;
}

if (process.env.NODE_ENV !== 'test') {
    main().catch(console.error);
}

export { sampleSitemapUrls, seededShuffle, stringToSeed, isLikelyHtmlUrl, fetchSitemap, shouldAllowDiscovery, selectBrowser, normalizeBrowserName, resolveSitemapSeed, shouldAnalyzeResponse, extractLinks };
