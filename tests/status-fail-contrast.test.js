import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

describe('status-fail color contrast', () => {
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
        'http://example.com': { 
          title: 'Home', 
          violations: [{
            id: 'test-violation',
            impact: 'critical',
            nodes: [{
              html: '<div>test</div>',
              target: ['div']
            }]
          }]
        }
      }
    };
    
    const summary = {
      runId: 'test-run',
      target: 'http://example.com',
      startedAt: '2024-01-01T00:00:00Z',
      pagesScanned: 1,
      totalViolations: 5,
      viewport: 'desktop',
      colorScheme: 'light',
      browser: 'chromium'
    };
    
    fs.writeFileSync(path.join(testRunPath, 'results.json'), JSON.stringify(results));
    fs.writeFileSync(path.join(testRunPath, 'summary.json'), JSON.stringify(summary));
    
    // Run generate-report.js to create index.html
    return new Promise((resolve, reject) => {
      const proc = spawn('node', ['scripts/generate-report.js'], { cwd: ROOT });
      let stdout = '';
      let stderr = '';
      proc.stdout.on('data', (data) => { stdout += data; });
      proc.stderr.on('data', (data) => { stderr += data; });
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`generate-report.js exited with code ${code}\nstdout: ${stdout}\nstderr: ${stderr}`));
      });
      proc.on('error', reject);
    });
  });

  afterAll(() => {
    fs.rmSync(siteDir, { recursive: true, force: true });
  });

  test('.status-fail uses #cc0000 color for sufficient contrast on white background', () => {
    const html = fs.readFileSync(indexPath, 'utf-8');

    // Check that .status-fail has color: #cc0000 specified
    // This ensures the contrast ratio meets WCAG 2.1 AA (4.5:1) for bold text on white background
    // Color #cc0000 provides 5.89:1 contrast ratio on white (#ffffff)
    // Original #ff0000 provided only 4.00:1 contrast
    expect(html).toMatch(/\.status-fail\s*\{[^}]*color:\s*#cc0000/);
  });

  test('.status-fail maintains bold font-weight for emphasis', () => {
    const html = fs.readFileSync(indexPath, 'utf-8');

    // Verify that font-weight: bold is preserved for visual emphasis
    expect(html).toMatch(/\.status-fail\s*\{[^}]*font-weight:\s*bold/);
  });
});
