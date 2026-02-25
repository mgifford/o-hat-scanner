import fs from 'fs';
import path from 'path';

let generateRunPage;
let analyzeResults;

describe('pill-warning contrast', () => {
  const __dirname = path.dirname(new URL(import.meta.url).pathname);
  const ROOT = path.resolve(__dirname, '..');
  const runId = 'test-pill-contrast';
  const domainSlug = 'example-com';
  const runRelPath = path.join(domainSlug, runId);
  const runDir = path.join(ROOT, 'site', 'runs', runRelPath);

  const results = {
    startedAt: '2024-01-01T00:00:00Z',
    mode: 'ci',
    targets: ['http://example.com'],
    resultsByUrl: {
      'http://example.com': { title: 'Home', violations: [] }
    }
  };

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    ({ generateRunPage, analyzeResults } = await import('../scripts/generate-report.js'));
    fs.rmSync(runDir, { recursive: true, force: true });
  });

  afterAll(() => {
    try {
      fs.rmSync(runDir, { recursive: true, force: true });
    } catch (err) {
      // Ignore cleanup errors
    }
  });

  test('uses appropriate colors for --pill-warning in light and dark themes', () => {
    fs.mkdirSync(runDir, { recursive: true });
    const stats = analyzeResults(results);
    generateRunPage(runId, runRelPath, results, stats);
    const html = fs.readFileSync(path.join(runDir, 'index.html'), 'utf-8');

    // Light theme should use #b95e00
    expect(html).toContain('--pill-warning: #b95e00');
    // Dark theme should use #fb923c (lighter orange for better contrast on dark backgrounds)
    expect(html).toMatch(/\[data-theme="dark"\][\s\S]*--pill-warning: #fb923c/);
  });
});
