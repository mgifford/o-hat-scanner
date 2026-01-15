import { shouldAnalyzeResponse } from '../scripts/scan-ci.js';

describe('shouldAnalyzeResponse', () => {
  test('skips 404 responses', () => {
    const result = shouldAnalyzeResponse({ status: 404, contentType: 'text/html' });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('404');
  });

  test('skips non-HTML content types', () => {
    const result = shouldAnalyzeResponse({ status: 200, contentType: 'application/zip' });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/non-html/i);
  });

  test('allows HTML responses', () => {
    const result = shouldAnalyzeResponse({ status: 200, contentType: 'text/html; charset=utf-8' });
    expect(result.ok).toBe(true);
  });
});
