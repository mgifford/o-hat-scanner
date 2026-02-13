import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

describe('run-id color contrast', () => {
  const __dirname = path.dirname(new URL(import.meta.url).pathname);
  const ROOT = path.resolve(__dirname, '..');
  const siteDir = path.join(ROOT, 'site');
  const runsDir = path.join(siteDir, 'runs');
  const indexPath = path.join(siteDir, 'index.html');

  beforeAll(() => {
    // Create minimal test data structure
    fs.rmSync(siteDir, { recursive: true, force: true });
    fs.mkdirSync(runsDir, { recursive: true });
    
    // Create a minimal results.json file to trigger report generation
    const testRunPath = path.join(runsDir, 'example-com', 'test-run');
    fs.mkdirSync(testRunPath, { recursive: true });
    
    const results = {
      runId: 'test-run',
      startedAt: '2024-01-01T00:00:00Z',
      finishedAt: '2024-01-01T00:01:00Z',
      mode: 'ci',
      targets: ['http://example.com'],
      resultsByUrl: {
        'http://example.com': { title: 'Home', violations: [] }
      }
    };
    
    const summary = {
      runId: 'test-run',
      target: 'http://example.com',
      startedAt: '2024-01-01T00:00:00Z',
      pagesScanned: 1,
      totalViolations: 0,
      viewport: 'desktop',
      colorScheme: 'light',
      browser: 'chromium'
    };
    
    fs.writeFileSync(path.join(testRunPath, 'results.json'), JSON.stringify(results));
    fs.writeFileSync(path.join(testRunPath, 'summary.json'), JSON.stringify(summary));
    
    // Run generate-report.js to create index.html
    return new Promise((resolve, reject) => {
      const proc = spawn('node', ['scripts/generate-report.js'], { cwd: ROOT });
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`generate-report.js exited with code ${code}`));
      });
      proc.on('error', reject);
    });
  });

  afterAll(() => {
    fs.rmSync(siteDir, { recursive: true, force: true });
  });

  test('.run-id uses #505050 color for sufficient contrast with 0.8 opacity', () => {
    const html = fs.readFileSync(indexPath, 'utf-8');

    // Check that .run-id has color: #505050 specified
    // This ensures the contrast ratio meets WCAG 2.1 AA (4.5:1) when combined with opacity: 0.8
    // Effective color: #707070 gives ~4.54:1 contrast on white background
    expect(html).toMatch(/\.run-id\s*\{[^}]*color:\s*#505050/);
    
    // Ensure opacity is still 0.8 (design requirement for subtle appearance)
    expect(html).toMatch(/\.run-id\s*\{[^}]*opacity:\s*0\.8/);
  });

  test('.run-id maintains full opacity on hover/focus for accessibility', () => {
    const html = fs.readFileSync(indexPath, 'utf-8');

    // Verify that hover and focus states increase opacity to 1
    expect(html).toMatch(/tr:hover\s+\.run-id.*opacity:\s*1/);
    expect(html).toMatch(/tr:focus-within\s+\.run-id.*opacity:\s*1/);
  });
});
