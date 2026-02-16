import fs from 'fs';
import path from 'path';

let generateMainIndex;

describe('run-id color contrast', () => {
  const __dirname = path.dirname(new URL(import.meta.url).pathname);
  const ROOT = path.resolve(__dirname, '..');
  const siteDir = path.join(ROOT, 'site');
  const indexHtml = path.join(siteDir, 'index.html');

  const runSummaries = [
    {
      runId: 'www-civicactions-com-2024-01-01T00-00-00Z',
      target: 'https://www.civicactions.com',
      startedAt: '2024-01-01T00:00:00Z',
      pagesScanned: 10,
      totalViolations: 5,
      viewport: 'desktop',
      colorScheme: 'light',
      browser: 'chromium'
    }
  ];

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    ({ generateMainIndex } = await import('../scripts/generate-report.js'));
    fs.mkdirSync(siteDir, { recursive: true });
  });

  afterAll(() => {
    try {
      fs.rmSync(indexHtml, { force: true });
    } catch (err) {
      // Ignore cleanup errors
    }
  });

  test('.target-meta uses #505050 to meet WCAG 2.1 AA contrast when .run-id has 0.8 opacity', () => {
    generateMainIndex(runSummaries);
    const html = fs.readFileSync(indexHtml, 'utf-8');
    
    // Verify .target-meta has color: #505050
    expect(html).toContain('.target-meta { font-size: 12px; color: #505050');
  });

  test('.run-id has opacity: 0.8', () => {
    generateMainIndex(runSummaries);
    const html = fs.readFileSync(indexHtml, 'utf-8');
    
    // Verify .run-id has opacity: 0.8
    expect(html).toContain('opacity: 0.8');
  });

  test('effective color #737373 provides 4.74:1 contrast ratio on white background', () => {
    // This test documents the calculation:
    // Base color #505050 with opacity 0.8 on white (#ffffff) background
    // = (80, 80, 80) * 0.8 + (255, 255, 255) * 0.2
    // = (64, 64, 64) + (51, 51, 51)
    // = (115, 115, 115)
    // = #737373
    // 
    // Contrast ratio of #737373 on #ffffff = 4.74:1
    // This meets WCAG 2.1 AA requirement of 4.5:1 for normal text
    
    generateMainIndex(runSummaries);
    const html = fs.readFileSync(indexHtml, 'utf-8');

    // The test passes if both color and opacity are set correctly
    expect(html).toContain('.target-meta { font-size: 12px; color: #505050');
    expect(html).toContain('opacity: 0.8');
  });
});
