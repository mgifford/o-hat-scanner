import { shouldAllowDiscovery } from '../scripts/scan-ci.js';

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
});
