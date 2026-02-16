#!/usr/bin/env node

/**
 * discover-top-pages.js
 * Discover and curate a list of canonical URLs for a domain via SERP API and navigation crawling.
 * 
 * Usage:
 *   node scripts/discover-top-pages.js \
 *     --baseUrl https://example.gov \
 *     --maxPages 100 \
 *     --outDir site/targets \
 *     --siteKey example-gov \
 *     --serpProvider bing|none
 * 
 * Outputs:
 *   - {outDir}/{siteKey}.urls.txt    : newline-delimited list of final URLs
 *   - {outDir}/{siteKey}.urls.json   : detailed metadata with scores, redirects, etc.
 */

import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { URL } from 'url';

// ============================================================================
// CONFIG
// ============================================================================

const DEFAULT_MAX_PAGES = 100;
const MAX_FETCH_TIMEOUT_MS = 15000;
const MAX_BODY_FETCH_LIMIT = 300; // Limit HTML fetches for fingerprinting to ~300
const NAV_CRAWL_DEPTH_LIMIT = 10; // Limit one-hop nav expansion to 10 pages
const MAX_REDIRECT_HOPS = 10;
const DEFAULT_USER_AGENT = 'o-hat-discovery/1.0 (+https://github.com/civicactions/o-hat-scanner)';

// Multilingual keywords for identifying required pages
const REQUIRED_PAGE_PATTERNS = {
  accessibility: {
    keywords: [
      'accessibility', 'accesibilidad', 'accessibilité', 'zugänglichkeit',
      'a11y', 'wcag', 'ada', 'section 508', 'equal access'
    ],
    urlPatterns: ['/accessibility', '/a11y', '/ada', '/wcag', '/accessible']
  },
  privacy: {
    keywords: [
      'privacy', 'privacidad', 'confidentialité', 'datenschutz',
      'data protection', 'gdpr', 'personal information'
    ],
    urlPatterns: ['/privacy', '/privacidad', '/confidentialite', '/datenschutz']
  },
  search: {
    keywords: ['search', 'búsqueda', 'recherche', 'suche'],
    urlPatterns: ['/search', '/búsqueda', '/recherche', '/suche']
  },
  terms: {
    keywords: [
      'terms', 'términos', 'conditions', 'condiciones',
      'terms of service', 'tos', 'usage'
    ],
    urlPatterns: ['/terms', '/terms-of-service', '/tos']
  },
  cookies: {
    keywords: ['cookie', 'cookies', 'cookie policy', 'politique de cookies'],
    urlPatterns: ['/cookies', '/cookie-policy']
  },
  security: {
    keywords: ['security', 'seguridad', 'sécurité', 'security policy'],
    urlPatterns: ['/security', '/security-policy']
  }
};

const ERROR_PAGE_KEYWORDS = [
  '404', 'not found', 'no encontrado', 'pagina no encontrada',
  'access denied', 'forbidden', '403',
  'error', 'erreur', 'error 500', 'internal server error',
  'page not available', 'esta página no existe'
];

// ============================================================================
// ARGUMENT PARSING
// ============================================================================

function parseArgs() {
  const result = {};
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i].startsWith('--')) {
      const key = process.argv[i].slice(2);
      result[key] = process.argv[i + 1] || true;
      i++;
    }
  }
  return result;
}

// ============================================================================
// HTTP HELPERS
// ============================================================================

async function fetchUrl(urlString, options = {}) {
  const {
    method = 'GET',
    timeout = MAX_FETCH_TIMEOUT_MS,
    followRedirects = true,
    maxRedirects = MAX_REDIRECT_HOPS,
    includeBody = true
  } = options;

  const redirectChain = [];
  let currentUrl = urlString;
  let redirectCount = 0;

  while (redirectCount < maxRedirects) {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(currentUrl, {
        method: method === 'HEAD' ? 'GET' : method, // Fallback to GET if HEAD not supported
        headers: {
          'User-Agent': DEFAULT_USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml'
        },
        signal: controller.signal,
        redirect: 'manual' // Manually handle redirects to track chain
      });

      clearTimeout(id);

      // Track redirect
      if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
        redirectChain.push({
          url: currentUrl,
          status: response.status,
          location: response.headers.get('location')
        });

        if (!followRedirects) {
          return { url: currentUrl, status: response.status, redirectChain, body: null, error: null };
        }

        // Resolve relative redirects
        const nextUrl = new URL(response.headers.get('location'), currentUrl).toString();
        currentUrl = nextUrl;
        redirectCount++;
        continue;
      }

      // Final response
      let body = null;
      let contentType = response.headers.get('content-type') || '';

      if (includeBody && response.ok && contentType.includes('text/html')) {
        body = await response.text();
      }

      return {
        url: currentUrl,
        status: response.status,
        contentType,
        redirectChain: redirectChain.length > 0 ? redirectChain : null,
        body,
        error: null
      };
    } catch (err) {
      return {
        url: currentUrl,
        status: null,
        redirectChain: redirectChain.length > 0 ? redirectChain : null,
        body: null,
        error: err.message
      };
    }
  }

  return {
    url: currentUrl,
    status: null,
    redirectChain,
    body: null,
    error: 'Max redirect hops exceeded'
  };
}

// ============================================================================
// PARSING & EXTRACTION
// ============================================================================

function parseHtml(html) {
  if (!html) return {};

  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const h1Match = html.match(/<h1[^>]*>([^<]*)<\/h1>/i);

  // Simple link extraction from nav, header, footer
  const linkMatches = html.matchAll(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi);
  const links = [];
  for (const match of linkMatches) {
    links.push({
      href: match[1],
      text: match[2]?.trim() || ''
    });
  }

  return {
    title: titleMatch ? titleMatch[1].trim() : '',
    h1: h1Match ? h1Match[1].trim() : '',
    links
  };
}

function extractMainText(html) {
  if (!html) return '';
  // Remove scripts, styles, nav, footer
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<(nav|footer|header)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<[^>]+>/g, ' ') // Remove tags
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
  return text.slice(0, 5000); // Sample first 5000 chars
}

function computeFingerprint(text) {
  if (!text) return null;
  return createHash('sha256').update(text.toLowerCase()).digest('hex');
}

// ============================================================================
// URL NORMALIZATION
// ============================================================================

const TRACKING_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
  'gclid', 'fbclid', 'mc_cid', 'mc_eid',
  'msclkid', 'twclid', 'agid', 'aceid'
];

function normalizeUrl(urlString, baseUrl) {
  try {
    const url = new URL(urlString, baseUrl);

    // Remove tracking params
    const params = new URLSearchParams(url.search);
    for (const param of TRACKING_PARAMS) {
      params.delete(param);
    }
    url.search = params.toString();

    // Remove fragments
    url.hash = '';

    // Normalize trailing slash for root
    if (url.pathname === '') {
      url.pathname = '/';
    }

    // Remove index.html
    if (url.pathname.endsWith('/index.html')) {
      url.pathname = url.pathname.slice(0, -10);
    }

    return url.toString();
  } catch {
    return null;
  }
}

function isSameOrigin(urlString, baseUrl) {
  try {
    const url = new URL(urlString);
    const base = new URL(baseUrl);
    return url.origin === base.origin;
  } catch {
    return false;
  }
}

// ============================================================================
// BING SEARCH API
// ============================================================================

async function fetchBingResults(query, apiKey, endpoint) {
  if (!apiKey) return [];

  try {
    const searchUrl = new URL('search', endpoint);
    searchUrl.searchParams.set('q', query);
    searchUrl.searchParams.set('count', '50');
    searchUrl.searchParams.set('mkt', 'en-US');
    searchUrl.searchParams.set('textFormat', 'HTML');

    const response = await fetch(searchUrl.toString(), {
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey,
        'User-Agent': DEFAULT_USER_AGENT
      },
      timeout: MAX_FETCH_TIMEOUT_MS
    });

    if (!response.ok) {
      console.log(`⚠️ Bing API returned ${response.status}`);
      return [];
    }

    const data = await response.json();
    const results = [];

    if (data.webPages && Array.isArray(data.webPages.value)) {
      for (const res of data.webPages.value) {
        results.push({
          url: res.url,
          title: res.name,
          snippet: res.snippet,
          position: results.length + 1
        });
      }
    }

    return results;
  } catch (err) {
    console.log(`⚠️ Bing API error: ${err.message}`);
    return [];
  }
}

async function discoverViaSERP(baseUrl, apiKey) {
  if (!apiKey) {
    console.log('ℹ️  No SERP API key; skipping SERP discovery');
    return { candidates: [], queries: [] };
  }

  console.log('🔍 Running SERP discovery...');

  const hostName = new URL(baseUrl).hostname;
  const queries = [
    `site:${hostName}`,
    `site:${hostName} accessibility`,
    `site:${hostName} privacy`,
    `site:${hostName} contact`,
    `site:${hostName} about`
  ];

  const endpoint = process.env.BING_ENDPOINT || 'https://api.bing.microsoft.com/v7.0/';
  const candidates = [];
  const resultsByQuery = {};

  for (const query of queries) {
    const results = await fetchBingResults(query, apiKey, endpoint);
    resultsByQuery[query] = results;

    for (const res of results) {
      candidates.push({
        url: res.url,
        title: res.title,
        snippet: res.snippet,
        source: 'serp',
        serpQuery: query,
        serpPosition: res.position,
        serpScore: 1.0 / (res.position || 1) // Higher rank = higher score
      });
    }
  }

  console.log(`  Found ${candidates.length} SERP candidates across ${queries.length} queries`);
  return { candidates, queries, resultsByQuery };
}

// ============================================================================
// NAVIGATION DISCOVERY
// ============================================================================

async function discoverViaNavigation(baseUrl) {
  console.log('🗺️  Running navigation discovery...');

  const candidates = [];
  const visited = new Set();
  const queue = [{ url: baseUrl, depth: 0, source: 'homepage' }];

  while (queue.length > 0 && visited.size < NAV_CRAWL_DEPTH_LIMIT) {
    const { url, depth, source } = queue.shift();

    if (visited.has(url) || !isSameOrigin(url, baseUrl)) {
      continue;
    }

    visited.add(url);

    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), MAX_FETCH_TIMEOUT_MS);

      const response = await fetch(url, {
        headers: { 'User-Agent': DEFAULT_USER_AGENT },
        signal: controller.signal
      });

      clearTimeout(id);

      if (!response.ok || !response.headers.get('content-type')?.includes('html')) {
        continue;
      }

      const html = await response.text();
      const parsed = parseHtml(html);

      // Extract links from nav, header, footer patterns
      for (const link of parsed.links) {
        if (!link.href) continue;

        try {
          const linkUrl = new URL(link.href, url).toString();
          if (!isSameOrigin(linkUrl, baseUrl) || visited.has(linkUrl)) {
            continue;
          }

          candidates.push({
            url: linkUrl,
            title: parsed.title,
            text: link.text,
            source: 'nav',
            depth: depth,
            sourceUrl: url
          });

          // Queue next level if first-hop
          if (depth === 0) {
            queue.push({ url: linkUrl, depth: depth + 1, source: 'nav-secondary' });
          }
        } catch {
          // Ignore malformed URLs
        }
      }
    } catch (err) {
      // Ignore fetch errors
    }
  }

  console.log(`  Found ${candidates.length} navigation candidates`);
  return { candidates };
}

// ============================================================================
// DEDUPLICATION & FILTERING
// ============================================================================

function deduplicateCandidates(candidates, baseUrl) {
  const byUrl = new Map();

  for (const cand of candidates) {
    const norm = normalizeUrl(cand.url, baseUrl);
    if (!norm || !isSameOrigin(norm, baseUrl)) continue;

    if (!byUrl.has(norm)) {
      byUrl.set(norm, { ...cand, url: norm, signals: {} });
    } else {
      // Merge signals
      const existing = byUrl.get(norm);
      if (cand.source === 'serp') {
        existing.signals.serp = { position: cand.serpPosition, score: cand.serpScore, query: cand.serpQuery };
      } else if (cand.source === 'nav') {
        existing.signals.nav = { depth: cand.depth, text: cand.text };
      }
    }
  }

  return Array.from(byUrl.values());
}

function isErrorPage(title, h1, body) {
  if (!title && !h1 && !body) return false;

  const text = `${title} ${h1} ${body}`.toLowerCase();
  return ERROR_PAGE_KEYWORDS.some(keyword => text.includes(keyword));
}

async function filterAndValidate(candidates, baseUrl) {
  console.log('✅ Validating candidates...');

  const validated = [];
  const excluded = [];
  let processed = 0;

  for (const cand of candidates) {
    processed++;
    if (processed % 10 === 0) {
      console.log(`   Checked ${processed}/${candidates.length}`);
    }

    const result = await fetchUrl(cand.url, {
      includeBody: true,
      followRedirects: true
    });

    if (result.error || !result.status || result.status !== 200) {
      excluded.push({
        ...cand,
        excludedReason: result.error ? `fetch_error: ${result.error}` : `http_${result.status}`,
        redirectChain: result.redirectChain
      });
      continue;
    }

    if (!result.contentType.includes('text/html')) {
      excluded.push({ ...cand, excludedReason: 'non_html', http: { status: result.status, contentType: result.contentType } });
      continue;
    }

    const parsed = parseHtml(result.body);

    if (isErrorPage(parsed.title, parsed.h1, result.body?.slice(0, 1000))) {
      excluded.push({ ...cand, excludedReason: 'error_page', http: { status: result.status, title: parsed.title } });
      continue;
    }

    validated.push({
      ...cand,
      url: result.url, // Use final URL
      http: { status: result.status, contentType: result.contentType },
      title: parsed.title,
      h1: parsed.h1,
      redirectChain: result.redirectChain,
      mainText: extractMainText(result.body)
    });
  }

  console.log(`  Validated: ${validated.length}, Excluded: ${excluded.length}`);
  return { validated, excluded };
}

// ============================================================================
// DEDUPLICATION (NEAR-DUPLICATE DETECTION)
// ============================================================================

function detectNearDuplicates(pages) {
  console.log('🔄 Detecting near-duplicates...');

  const fingerprints = new Map();
  const duplicates = [];

  for (const page of pages) {
    const fp = computeFingerprint(page.mainText);
    if (!fp) continue;

    if (fingerprints.has(fp)) {
      const original = fingerprints.get(fp);
      // Mark lower-scoring one as duplicate
      if (page.score > original.score) {
        duplicates.push({ ...original, duplicateOf: page.url, excludedReason: 'duplicate' });
        fingerprints.set(fp, page);
      } else {
        duplicates.push({ ...page, duplicateOf: original.url, excludedReason: 'duplicate' });
      }
    } else {
      fingerprints.set(fp, page);
    }
  }

  const unique = Array.from(fingerprints.values());
  console.log(`  Unique: ${unique.length}, Near-duplicates: ${duplicates.length}`);

  return { unique, duplicates };
}

// ============================================================================
// REQUIRED PAGE MATCHING
// ============================================================================

function matchRequiredPages(pages, baseUrl) {
  const required = {};

  for (const [pageType, patterns] of Object.entries(REQUIRED_PAGE_PATTERNS)) {
    for (const page of pages) {
      const urlPath = new URL(page.url, baseUrl).pathname.toLowerCase();
      const titleLower = (page.title || '').toLowerCase();
      const h1Lower = (page.h1 || '').toLowerCase();

      const matchesUrl = patterns.urlPatterns.some(p => urlPath.includes(p));
      const matchesKeyword = patterns.keywords.some(k => titleLower.includes(k) || h1Lower.includes(k));

      if (matchesUrl || matchesKeyword) {
        if (!required[pageType] || page.score > required[pageType].score) {
          required[pageType] = page;
        }
      }
    }
  }

  return required;
}

// ============================================================================
// SCORING
// ============================================================================

function scorePages(pages, requiredPages) {
  console.log('📊 Scoring pages...');

  const homeUrl = new URL('/', pages[0]?.url || 'http://example.com').toString();
  let score = 1000; // Start high, decrement

  for (const page of pages) {
    let pageScore = 500; // Base score

    // SERP position bonus
    if (page.signals?.serp?.score) {
      pageScore += page.signals.serp.score * 200;
    }

    // Navigation prominence bonus
    if (page.signals?.nav) {
      pageScore += Math.max(0, 150 - page.signals.nav.depth * 30);
    }

    // Required page bonus
    for (const [type, reqPage] of Object.entries(requiredPages)) {
      if (reqPage && reqPage.url === page.url) {
        pageScore += 300;
      }
    }

    // Home page bonus
    if (page.url === homeUrl) {
      pageScore = 5000; // Always top
    }

    page.score = Math.floor(pageScore);
  }

  // Sort by score descending
  pages.sort((a, b) => b.score - a.score);
  console.log(`  Scored ${pages.length} pages`);

  return pages;
}

// ============================================================================
// DISCOVERY ORCHESTRATION
// ============================================================================

async function discoverTopPages(baseUrl, maxPages, apiKey) {
  console.log(`\n🚀 Discovering top pages for ${baseUrl} (max: ${maxPages})`);
  console.log('');

  // Step 1: Gather candidates
  const serpResult = await discoverViaSERP(baseUrl, apiKey);
  const navResult = await discoverViaNavigation(baseUrl);

  const allCandidates = [
    ...serpResult.candidates,
    ...navResult.candidates
  ];

  console.log(`\n📋 Combined sources: ${allCandidates.length} candidates`);

  // Step 2: Deduplicate and normalize
  const dedupedCandidates = deduplicateCandidates(allCandidates, baseUrl);
  console.log(`✂️  After merge: ${dedupedCandidates.length} unique normalized URLs`);

  // Step 3: Validate and fetch
  const { validated, excluded } = await filterAndValidate(dedupedCandidates, baseUrl);

  // Step 4: Detect near-duplicates
  let finalPages = validated;
  if (validated.length > 0) {
    const { unique, duplicates } = detectNearDuplicates(validated);
    finalPages = unique;
    excluded.push(...duplicates);
  }

  // Step 5: Match required pages
  const requiredPages = matchRequiredPages(finalPages, baseUrl);
  console.log(`\n🎯 Matched required pages: ${Object.keys(requiredPages).map(k => requiredPages[k] ? k : null).filter(Boolean).join(', ') || '(none)'}`);

  // Step 6: Score and sort
  const scored = scorePages(finalPages, requiredPages);

  // Step 7: Ensure required pages and truncate
  const final = [];
  const included = new Set();

  // First pass: add required pages
  for (const [type, page] of Object.entries(requiredPages)) {
    if (page && !included.has(page.url)) {
      final.push({ ...page, category: `policy|${type}` });
      included.add(page.url);
    }
  }

  // Second pass: add highest-scored pages up to maxPages
  for (const page of scored) {
    if (!included.has(page.url) && final.length < maxPages) {
      final.push({ ...page, category: page.score > 1000 ? 'top-task' : 'hub' });
      included.add(page.url);
    }
    if (final.length >= maxPages) break;
  }

  console.log(`\n✨ Final list: ${final.length} pages (required: ${Object.keys(requiredPages).length})`);

  return {
    pages: final,
    excluded,
    stats: {
      candidates: allCandidates.length,
      afterNormalize: dedupedCandidates.length,
      afterValidate: validated.length,
      afterDedupe: finalPages.length,
      final: final.length
    },
    serp: {
      enabled: !!apiKey,
      provider: apiKey ? 'bing' : 'none',
      queries: serpResult.queries || []
    },
    requiredPages
  };
}

// ============================================================================
// OUTPUT
// ============================================================================

function generateMetadata(discovery, baseUrl, maxPages) {
  const requiredPagesObj = {};
  for (const [type, page] of Object.entries(discovery.requiredPages)) {
    if (page) {
      requiredPagesObj[type] = page.url;
    }
  }

  return {
    baseUrl,
    maxPages,
    generatedAt: new Date().toISOString(),
    serp: discovery.serp,
    stats: discovery.stats,
    requiredPages: requiredPagesObj,
    pages: discovery.pages.map(p => ({
      url: p.url,
      score: p.score,
      category: p.category || 'other',
      signals: p.signals || {},
      redirectChain: p.redirectChain || null,
      http: p.http || {},
      title: p.title || '',
      h1: p.h1 || '',
      fingerprint: computeFingerprint(p.mainText),
      duplicateOf: p.duplicateOf || null,
      excludedReason: p.excludedReason || null
    })),
    excluded: discovery.excluded.map(p => ({
      url: p.url,
      title: p.title || '',
      redirectChain: p.redirectChain || null,
      excludedReason: p.excludedReason || null
    }))
  };
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const args = parseArgs();

  const baseUrl = args.baseUrl || process.env.INPUT_BASE_URL;
  const maxPages = parseInt(args.maxPages, 10) || DEFAULT_MAX_PAGES;
  const outDir = args.outDir || 'site/targets';
  const siteKey = args.siteKey || 'unknown';
  const apiKey = args.serpProvider !== 'none' ? process.env.BING_API_KEY : null;

  if (!baseUrl) {
    console.error('❌ --baseUrl is required');
    process.exit(1);
  }

  // Ensure output directory
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  try {
    const discovery = await discoverTopPages(baseUrl, maxPages, apiKey);
    const metadata = generateMetadata(discovery, baseUrl, maxPages);

    // Write JSON
    const jsonPath = path.join(outDir, `${siteKey}.urls.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(metadata, null, 2));
    console.log(`\n✅ Wrote ${jsonPath}`);

    // Write TXT
    const txtPath = path.join(outDir, `${siteKey}.urls.txt`);
    const urlsList = discovery.pages.map(p => p.url).join('\n');
    fs.writeFileSync(txtPath, urlsList + '\n');
    console.log(`✅ Wrote ${txtPath}`);

    // Summary
    console.log(`\n📊 Summary`);
    console.log(`  Base URL: ${baseUrl}`);
    console.log(`  Requested: ${maxPages}, Found: ${discovery.pages.length}`);
    console.log(`  Stats: candidates=${discovery.stats.candidates}, normalized=${discovery.stats.afterNormalize}, validated=${discovery.stats.afterValidate}, dedupe=${discovery.stats.afterDedupe}, final=${discovery.stats.final}`);
    console.log(`  SERP: ${discovery.serp.enabled ? `enabled (${discovery.serp.provider})` : 'disabled'}`);
    console.log(`  Required pages: ${Object.keys(discovery.requiredPages).filter(k => discovery.requiredPages[k]).join(', ') || '(none)'}`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Discovery failed:', err.message);
    process.exit(1);
  }
}

main();
