import { sampleSitemapUrls, isLikelyHtmlUrl } from '../scripts/scan-ci.js';

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

  test('filters out skipped extensions before sampling', () => {
    const mixed = [
      'https://example.com/report.pdf',
      'https://example.com/page-1',
      'https://example.com/doc.docx',
      'https://example.com/page-2',
      'https://example.com/archive.zip',
      'https://example.com/page-3'
    ];
    const sample = sampleSitemapUrls(mixed, { maxPages: 4, strategy: 'shuffle', seed: 'filter-seed' });
    expect(sample.every(isLikelyHtmlUrl)).toBe(true);
    expect(sample.length).toBe(3); // only the html-like entries remain
  });
});
