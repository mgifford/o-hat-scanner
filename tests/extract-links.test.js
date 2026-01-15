import { extractLinks } from '../scripts/scan-ci.js';

describe('extractLinks', () => {
  const html = `
    <a href="/alpha">Alpha</a>
    <a href="https://example.com/beta">Beta</a>
    <a href="https://other.com/gamma">Gamma</a>
    <a href="/download.zip">Zip</a>
    <a href="/delta#fragment">Delta</a>
  `;

  test('returns same-origin, html-like links only', () => {
    const links = extractLinks('https://example.com/base', html);
    expect(links).toContain('https://example.com/alpha');
    expect(links).toContain('https://example.com/beta');
    expect(links).toContain('https://example.com/delta');
    expect(links.some(l => l.includes('download.zip'))).toBe(false);
    expect(links.some(l => l.includes('other.com'))).toBe(false);
  });
});
