import { shouldAllowDiscovery, normalizeBrowserName, selectBrowser, isLikelyHtmlUrl } from '../scripts/scan-ci.js';
import { chromium, firefox, webkit } from 'playwright';

describe('shouldAllowDiscovery', () => {
  test('allows when mode is crawl', () => {
    expect(shouldAllowDiscovery('crawl', false)).toBe(true);
    expect(shouldAllowDiscovery('crawl', true)).toBe(true);
  });

  test('allows when sitemap fallback triggered', () => {
    expect(shouldAllowDiscovery('sitemap', true)).toBe(true);
  });

  test('disallows when sitemap with no fallback', () => {
    expect(shouldAllowDiscovery('sitemap', false)).toBe(false);
    expect(shouldAllowDiscovery('list', false)).toBe(false);
  });

  test('normalizes browser names', () => {
    expect(normalizeBrowserName('chromium')).toBe('chromium');
    expect(normalizeBrowserName('chrome')).toBe('chromium');
    expect(normalizeBrowserName('firefox')).toBe('firefox');
    expect(normalizeBrowserName('webkit')).toBe('webkit');
    expect(normalizeBrowserName('safari')).toBe('webkit');
    expect(normalizeBrowserName('unknown')).toBe('chromium');
  });

  test('selectBrowser returns playwright launcher', () => {
    expect(selectBrowser('chromium')).toBe(chromium);
    expect(selectBrowser('firefox')).toBe(firefox);
    expect(selectBrowser('webkit')).toBe(webkit);
  });

  test('isLikelyHtmlUrl handles uppercase extensions', () => {
    expect(isLikelyHtmlUrl('https://example.com/foo.PDF')).toBe(false);
    expect(isLikelyHtmlUrl('https://example.com/foo.HTML')).toBe(true);
  });
});
