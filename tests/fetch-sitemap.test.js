import { jest } from '@jest/globals';
import { fetchSitemap } from '../scripts/scan-ci.js';

const indexXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://example.com/map-a.xml</loc></sitemap>
  <sitemap><loc>https://example.com/map-b.xml</loc></sitemap>
</sitemapindex>`;

const mapAXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/page-1</loc></url>
  <url><loc>https://example.com/doc.pdf</loc></url>
  <url><loc>https://example.com/page-2</loc></url>
</urlset>`;

const mapBXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/page-3</loc></url>
  <url><loc>https://example.com/archive.zip</loc></url>
  <url><loc>https://example.com/page-4</loc></url>
</urlset>`;

function makeLargeIndex(count = 20) {
  const items = Array.from({ length: count }, (_, i) => `<sitemap><loc>https://example.com/map-${i + 1}.xml</loc></sitemap>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${items}
</sitemapindex>`;
}

function makeMapXml(id) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/page-${id}</loc></url>
</urlset>`;
}

describe('fetchSitemap', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    jest.spyOn(console, 'log').mockImplementation(() => {});
    global.fetch = jest.fn(async (url) => {
      if (url.endsWith('map-a.xml')) {
        return { ok: true, text: async () => mapAXml };
      }
      if (url.endsWith('map-b.xml')) {
        return { ok: true, text: async () => mapBXml };
      }
      return { ok: true, text: async () => indexXml };
    });
  });

  afterEach(() => {
    console.log.mockRestore();
    delete global.fetch;
  });

  test('recurses sitemap index, filters non-html, and caps to maxPages', async () => {
    const urls = await fetchSitemap('https://example.com/sitemap.xml', {
      maxPages: 2,
      strategy: 'sequential',
      seed: 'ignored'
    });
    expect(urls).toHaveLength(2);
    expect(urls.every(u => u.endsWith('page-1') || u.endsWith('page-2') || u.endsWith('page-3') || u.endsWith('page-4'))).toBe(true);
    expect(urls.some(u => u.endsWith('.pdf') || u.endsWith('.zip'))).toBe(false);
  });

  test('shuffle strategy respects seed for deterministic sampling', async () => {
    const first = await fetchSitemap('https://example.com/sitemap.xml', {
      maxPages: 3,
      strategy: 'shuffle',
      seed: 'seed-1'
    });
    const second = await fetchSitemap('https://example.com/sitemap.xml', {
      maxPages: 3,
      strategy: 'shuffle',
      seed: 'seed-1'
    });
    expect(first).toEqual(second);
  });

  test('sitemap index sampling limits child sitemaps when large', async () => {
    const bigIndex = makeLargeIndex(20);
    const fetched = [];
    global.fetch.mockImplementation(async (url) => {
      fetched.push(url);
      if (url.includes('sitemap.xml') && !url.includes('map-')) {
        return { ok: true, text: async () => bigIndex, headers: () => ({}) };
      }
      if (url.includes('map-')) {
        const id = url.match(/map-(\d+)/)?.[1] || 'x';
        return { ok: true, text: async () => makeMapXml(id), headers: () => ({}) };
      }
      return { ok: false, text: async () => '' };
    });

    const urls = await fetchSitemap('https://example.com/sitemap.xml', {
      maxPages: 5,
      strategy: 'shuffle',
      seed: 'sample-seed'
    });

    const childFetches = fetched.filter(u => u.includes('map-')).length;
    expect(childFetches).toBeLessThanOrEqual(10);
    expect(childFetches).toBeGreaterThan(0);
    expect(fetched.length).toBeLessThanOrEqual(11); // index + sampled children
    expect(urls.length).toBeLessThanOrEqual(5);
  });
});
