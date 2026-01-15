import { resolveSitemapSeed } from '../scripts/scan-ci.js';

describe('resolveSitemapSeed', () => {
  test('prefers provided seed over label and host fallback', () => {
    const seed = resolveSitemapSeed({
      providedSeed: 'explicit-seed',
      label: 'label-seed',
      baseUrl: 'https://example.com',
      urlObj: new URL('https://other.test/sitemap.xml')
    });
    expect(seed).toBe('explicit-seed');
  });

  test('falls back to label then baseUrl then hostname', () => {
    const fromLabel = resolveSitemapSeed({ label: 'label-seed' });
    expect(fromLabel).toBe('label-seed');

    const fromBase = resolveSitemapSeed({ baseUrl: 'https://base.test' });
    expect(fromBase).toBe('https://base.test');

    const fromHost = resolveSitemapSeed({ urlObj: new URL('https://host.test/map.xml') });
    expect(fromHost).toBe('host.test');
  });

  test('defaults to sitemap when nothing is provided', () => {
    expect(resolveSitemapSeed({})).toBe('sitemap');
  });
});
