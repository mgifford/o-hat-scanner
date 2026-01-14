import { sampleSitemapUrls } from '../scripts/scan-ci.js';

describe('sampleSitemapUrls', () => {
  const urls = Array.from({ length: 20 }, (_, i) => `https://example.com/page-${i}`);

  test('returns deterministic shuffled sample for the same seed', () => {
    const sampleA = sampleSitemapUrls(urls, { maxPages: 5, strategy: 'shuffle', seed: 'seed-one' });
    const sampleB = sampleSitemapUrls(urls, { maxPages: 5, strategy: 'shuffle', seed: 'seed-one' });
    expect(sampleA).toEqual(sampleB);
    expect(sampleA.length).toBe(5);
    expect(new Set(sampleA).size).toBe(sampleA.length);
  });

  test('different seeds produce different ordering', () => {
    const sampleA = sampleSitemapUrls(urls, { maxPages: 5, strategy: 'shuffle', seed: 'seed-one' });
    const sampleB = sampleSitemapUrls(urls, { maxPages: 5, strategy: 'shuffle', seed: 'seed-two' });
    expect(sampleA).not.toEqual(sampleB);
  });

  test('sequential strategy respects maxPages cap', () => {
    const sample = sampleSitemapUrls(urls, { maxPages: 3, strategy: 'sequential', seed: 'ignored' });
    expect(sample).toEqual(urls.slice(0, 3));
  });
});
