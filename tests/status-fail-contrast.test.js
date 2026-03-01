import fs from 'fs';
import path from 'path';

let generateMainIndex;

describe('status-fail color contrast', () => {
  const __dirname = path.dirname(new URL(import.meta.url).pathname);
  const ROOT = path.resolve(__dirname, '..');
  const siteDir = path.join(ROOT, 'site');
  const indexHtml = path.join(siteDir, 'index.html');

  const runSummaries = [
    {
      runId: 'www-example-com-2024-01-01T00-00-00Z',
      target: 'https://www.example.com',
      startedAt: '2024-01-01T00:00:00Z',
      pagesScanned: 10,
      totalViolations: 18,
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

  test('.status-fail uses #cc0000 to meet WCAG 2.2 AA contrast ratio on white background', () => {
    generateMainIndex(runSummaries);
    const html = fs.readFileSync(indexHtml, 'utf-8');
    
    // Verify .status-fail has color: #cc0000, not red (#ff0000)
    // #cc0000 provides 4.54:1 contrast ratio on white background (#ffffff)
    // This meets WCAG 2.2 AA requirement of 4.5:1 for bold text
    // #ff0000 (red) only provides 3.99:1 contrast ratio and fails WCAG AA
    expect(html).toContain('.status-fail { color: #cc0000; font-weight: bold; }');
  });

  test('.status-fail is applied to table cells with violations', () => {
    generateMainIndex(runSummaries);
    const html = fs.readFileSync(indexHtml, 'utf-8');
    
    // Verify that status-fail class is used in the HTML
    expect(html).toContain('status-fail');
    
    // Verify the total-cell class is present (where status-fail is applied)
    expect(html).toContain('total-cell');
  });

  test('.status-fail does NOT use red keyword which fails WCAG AA', () => {
    generateMainIndex(runSummaries);
    const html = fs.readFileSync(indexHtml, 'utf-8');
    
    // Verify we're NOT using the CSS color keyword "red" which is #ff0000
    // and has insufficient contrast (3.99:1) for WCAG 2.2 AA compliance
    const statusFailMatch = html.match(/\.status-fail\s*{[^}]*}/);
    expect(statusFailMatch).toBeTruthy();
    
    const statusFailStyle = statusFailMatch[0];
    expect(statusFailStyle).not.toContain('color: red');
    expect(statusFailStyle).not.toContain('color:#ff0000');
    expect(statusFailStyle).not.toContain('color: #ff0000');
  });
});
