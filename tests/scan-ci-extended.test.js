import {
  stringToSeed,
  seededShuffle,
  sampleSitemapUrls,
  isLikelyHtmlUrl,
  shouldAnalyzeResponse,
  extractLinks,
  shouldAllowDiscovery,
  normalizeBrowserName,
} from '../scripts/scan-ci.js';

describe('stringToSeed', () => {
  test('returns a positive integer for a normal string', () => {
    const seed = stringToSeed('hello');
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThan(0);
  });

  test('returns same value for the same input', () => {
    expect(stringToSeed('abc')).toBe(stringToSeed('abc'));
  });

  test('returns different values for different inputs', () => {
    expect(stringToSeed('abc')).not.toBe(stringToSeed('xyz'));
  });

  test('defaults to sitemap string when given null/undefined', () => {
    expect(stringToSeed(null)).toBe(stringToSeed('sitemap'));
    expect(stringToSeed(undefined)).toBe(stringToSeed('sitemap'));
    expect(stringToSeed('')).toBe(stringToSeed('sitemap'));
  });

  test('never returns zero', () => {
    // Ensure we never get zero which would break the PRNG
    const seeds = ['a', 'b', 'test', 'sitemap', '1', '0', 'x'.repeat(100)];
    for (const s of seeds) {
      expect(stringToSeed(s)).toBeGreaterThan(0);
    }
  });
});

describe('seededShuffle', () => {
  const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  test('returns array of same length', () => {
    const result = seededShuffle(input, 42);
    expect(result).toHaveLength(input.length);
  });

  test('contains all original elements', () => {
    const result = seededShuffle(input, 42);
    expect(result.sort((a, b) => a - b)).toEqual(input);
  });

  test('is deterministic for the same seed', () => {
    const a = seededShuffle(input, 99);
    const b = seededShuffle(input, 99);
    expect(a).toEqual(b);
  });

  test('produces different ordering for different seeds', () => {
    const a = seededShuffle(input, 1);
    const b = seededShuffle(input, 999999);
    expect(a).not.toEqual(b);
  });

  test('does not mutate the original array', () => {
    const original = [1, 2, 3];
    seededShuffle(original, 7);
    expect(original).toEqual([1, 2, 3]);
  });

  test('handles empty array', () => {
    expect(seededShuffle([], 1)).toEqual([]);
  });

  test('handles single-element array', () => {
    expect(seededShuffle(['only'], 1)).toEqual(['only']);
  });
});

describe('isLikelyHtmlUrl – extended', () => {
  test('accepts plain HTML-like paths', () => {
    expect(isLikelyHtmlUrl('https://example.com/')).toBe(true);
    expect(isLikelyHtmlUrl('https://example.com/about')).toBe(true);
    expect(isLikelyHtmlUrl('https://example.com/blog/post')).toBe(true);
    expect(isLikelyHtmlUrl('https://example.com/page.html')).toBe(true);
    expect(isLikelyHtmlUrl('https://example.com/page.htm')).toBe(true);
  });

  test('rejects PDF and document extensions', () => {
    expect(isLikelyHtmlUrl('https://example.com/doc.pdf')).toBe(false);
    expect(isLikelyHtmlUrl('https://example.com/report.docx')).toBe(false);
    expect(isLikelyHtmlUrl('https://example.com/sheet.xls')).toBe(false);
    expect(isLikelyHtmlUrl('https://example.com/slides.pptx')).toBe(false);
  });

  test('rejects archive extensions', () => {
    expect(isLikelyHtmlUrl('https://example.com/data.zip')).toBe(false);
    expect(isLikelyHtmlUrl('https://example.com/backup.tar')).toBe(false);
    expect(isLikelyHtmlUrl('https://example.com/backup.gz')).toBe(false);
    expect(isLikelyHtmlUrl('https://example.com/archive.7z')).toBe(false);
  });

  test('handles uppercase extensions correctly', () => {
    expect(isLikelyHtmlUrl('https://example.com/file.PDF')).toBe(false);
    expect(isLikelyHtmlUrl('https://example.com/file.HTML')).toBe(true);
  });

  test('handles trailing slash on archive', () => {
    expect(isLikelyHtmlUrl('https://example.com/file.zip/')).toBe(false);
  });

  test('accepts URLs with no file extension', () => {
    expect(isLikelyHtmlUrl('https://example.com/services/digital-accessibility')).toBe(true);
  });

  test('accepts paths with dots in segments (not extensions)', () => {
    // A dot in a path segment that is not a skipped extension should be allowed
    expect(isLikelyHtmlUrl('https://example.com/v1.2/changelog')).toBe(true);
  });

  test('returns false for invalid URL input', () => {
    expect(isLikelyHtmlUrl('not-a-url')).toBe(false);
    expect(isLikelyHtmlUrl('')).toBe(false);
  });
});

describe('shouldAnalyzeResponse – extended', () => {
  test('rejects HTTP 400', () => {
    const r = shouldAnalyzeResponse({ status: 400, contentType: 'text/html' });
    expect(r.ok).toBe(false);
  });

  test('rejects HTTP 500', () => {
    const r = shouldAnalyzeResponse({ status: 500, contentType: 'text/html' });
    expect(r.ok).toBe(false);
  });

  test('accepts HTTP 200 with text/html', () => {
    const r = shouldAnalyzeResponse({ status: 200, contentType: 'text/html; charset=utf-8' });
    expect(r.ok).toBe(true);
  });

  test('accepts HTTP 200 with no content-type (treated as HTML)', () => {
    const r = shouldAnalyzeResponse({ status: 200, contentType: '' });
    expect(r.ok).toBe(true);
  });

  test('accepts HTTP 200 with undefined content-type', () => {
    const r = shouldAnalyzeResponse({ status: 200 });
    expect(r.ok).toBe(true);
  });

  test('rejects image content type', () => {
    const r = shouldAnalyzeResponse({ status: 200, contentType: 'image/png' });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/non-html/i);
  });

  test('rejects application/json content type', () => {
    const r = shouldAnalyzeResponse({ status: 200, contentType: 'application/json' });
    expect(r.ok).toBe(false);
  });

  test('handles completely empty argument', () => {
    const r = shouldAnalyzeResponse();
    expect(r.ok).toBe(true); // no status code, no content-type → allow
  });

  test('rejects HTTP 301 redirect status when >= 400 check passes, but 301 < 400', () => {
    // 301 is a redirect and not >= 400, so it should be allowed
    const r = shouldAnalyzeResponse({ status: 301, contentType: 'text/html' });
    expect(r.ok).toBe(true);
  });
});

describe('extractLinks – extended', () => {
  test('resolves relative href to absolute', () => {
    const html = '<a href="/contact">Contact</a>';
    const links = extractLinks('https://example.com/', html);
    expect(links).toContain('https://example.com/contact');
  });

  test('strips hash fragments', () => {
    const html = '<a href="/page#section">Section</a>';
    const links = extractLinks('https://example.com/', html);
    expect(links).toContain('https://example.com/page');
    expect(links.every(l => !l.includes('#'))).toBe(true);
  });

  test('excludes cross-origin links', () => {
    const html = '<a href="https://other.com/page">Other</a>';
    const links = extractLinks('https://example.com/', html);
    expect(links).toHaveLength(0);
  });

  test('deduplicates identical URLs', () => {
    const html = '<a href="/about">A</a><a href="/about">B</a>';
    const links = extractLinks('https://example.com/', html);
    const aboutLinks = links.filter(l => l.endsWith('/about'));
    expect(aboutLinks).toHaveLength(1);
  });

  test('filters out non-HTML links', () => {
    const html = '<a href="/file.pdf">PDF</a><a href="/archive.zip">Zip</a>';
    const links = extractLinks('https://example.com/', html);
    expect(links).toHaveLength(0);
  });

  test('returns empty array for empty HTML', () => {
    expect(extractLinks('https://example.com/', '')).toEqual([]);
  });

  test('returns empty array for null HTML', () => {
    expect(extractLinks('https://example.com/', null)).toEqual([]);
  });

  test('returns empty array for invalid baseUrl', () => {
    expect(extractLinks('not-a-url', '<a href="/page">Page</a>')).toEqual([]);
  });

  test('handles anchor tags without href attribute', () => {
    const html = '<a name="anchor">Anchor</a><a href="/valid">Valid</a>';
    const links = extractLinks('https://example.com/', html);
    expect(links).toContain('https://example.com/valid');
    expect(links).toHaveLength(1);
  });
});

describe('shouldAllowDiscovery – extended', () => {
  test('allows for crawl mode regardless of fallback flag', () => {
    expect(shouldAllowDiscovery('crawl', false)).toBe(true);
    expect(shouldAllowDiscovery('crawl', true)).toBe(true);
  });

  test('allows for sitemap when fallback is used', () => {
    expect(shouldAllowDiscovery('sitemap', true)).toBe(true);
  });

  test('disallows for list mode without fallback', () => {
    expect(shouldAllowDiscovery('list', false)).toBe(false);
  });

  test('disallows for sitemap without fallback', () => {
    expect(shouldAllowDiscovery('sitemap', false)).toBe(false);
  });
});

describe('normalizeBrowserName – extended', () => {
  test('normalizes chrome alias to chromium', () => {
    expect(normalizeBrowserName('chrome')).toBe('chromium');
  });

  test('normalizes safari alias to webkit', () => {
    expect(normalizeBrowserName('safari')).toBe('webkit');
  });

  test('returns chromium for unknown names', () => {
    expect(normalizeBrowserName('ie')).toBe('chromium');
    expect(normalizeBrowserName('')).toBe('chromium');
  });

  test('handles mixed case input', () => {
    expect(normalizeBrowserName('CHROMIUM')).toBe('chromium');
    expect(normalizeBrowserName('Firefox')).toBe('firefox');
    expect(normalizeBrowserName('WebKit')).toBe('webkit');
  });
});

describe('sampleSitemapUrls – extended', () => {
  test('returns empty array for non-array input', () => {
    expect(sampleSitemapUrls(null, { maxPages: 5 })).toEqual([]);
    expect(sampleSitemapUrls(undefined, { maxPages: 5 })).toEqual([]);
  });

  test('returns empty array for maxPages 0', () => {
    const urls = ['https://example.com/page-1', 'https://example.com/page-2'];
    expect(sampleSitemapUrls(urls, { maxPages: 0 })).toEqual([]);
  });

  test('returns all urls when maxPages exceeds url count', () => {
    const urls = ['https://example.com/a', 'https://example.com/b'];
    const result = sampleSitemapUrls(urls, { maxPages: 100 });
    expect(result).toHaveLength(2);
  });

  test('sequential strategy respects order', () => {
    const urls = ['https://example.com/first', 'https://example.com/second', 'https://example.com/third'];
    const result = sampleSitemapUrls(urls, { maxPages: 2, strategy: 'sequential' });
    expect(result).toEqual(['https://example.com/first', 'https://example.com/second']);
  });

  test('filters out non-HTML URLs before applying limit', () => {
    const urls = [
      'https://example.com/page-1',
      'https://example.com/doc.pdf',
      'https://example.com/page-2',
      'https://example.com/archive.zip',
      'https://example.com/page-3'
    ];
    const result = sampleSitemapUrls(urls, { maxPages: 10, strategy: 'sequential' });
    expect(result).toHaveLength(3);
    expect(result.every(u => !u.endsWith('.pdf') && !u.endsWith('.zip'))).toBe(true);
  });
});
