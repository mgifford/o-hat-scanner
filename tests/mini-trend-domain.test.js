import fs from 'fs';
import path from 'path';

let generateRunPage;
let analyzeResults;

describe('mini trend uses domain not full URL', () => {
  const __dirname = path.dirname(new URL(import.meta.url).pathname);
  const ROOT = path.resolve(__dirname, '..');
  const runId = 'test-mini-trend-domain';
  const domainSlug = 'example-com';
  const runRelPath = path.join(domainSlug, runId);
  const runDir = path.join(ROOT, 'site', 'runs', runRelPath);

  const sampleResults = {
    runId,
    startedAt: '2026-01-15T10:00:00Z',
    finishedAt: '2026-01-15T10:05:00Z',
    toolVersion: 'test',
    mode: 'ci',
    config: {
      viewport: 'desktop',
      colorScheme: 'light',
      browser: 'chromium'
    },
    targets: ['https://www.example.com/path/to/page'],
    resultsByUrl: {
      'https://www.example.com/': { violations: [], title: 'Home' },
      'https://www.example.com/about': { violations: [], title: 'About' }
    }
  };

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    const mod = await import('../scripts/generate-report.js');
    generateRunPage = mod.generateRunPage;
    analyzeResults = mod.analyzeResults;
    fs.mkdirSync(runDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(path.join(runDir, 'index.html'), { force: true });
  });

  test('data-target attribute contains domain not full URL', () => {
    const stats = analyzeResults(sampleResults);
    generateRunPage(runId, runRelPath, sampleResults, stats);
    const html = fs.readFileSync(path.join(runDir, 'index.html'), 'utf-8');

    // The mini-trend container should have data-target set to domain only
    expect(html).toContain('data-target="www.example.com"');
    
    // Should NOT contain the full URL with path
    expect(html).not.toContain('data-target="https://www.example.com/path/to/page"');
  });

  test('data-target matches what buildAggregateRows stores in CSV', () => {
    const stats = analyzeResults(sampleResults);
    generateRunPage(runId, runRelPath, sampleResults, stats);
    const html = fs.readFileSync(path.join(runDir, 'index.html'), 'utf-8');

    // Extract the data-target value from HTML
    const match = html.match(/data-target="([^"]+)"/);
    expect(match).toBeTruthy();
    const dataTarget = match[1];

    // This should match what extractDomain would return for the target URL
    // which is what buildAggregateRows stores in the aggregate CSV
    expect(dataTarget).toBe('www.example.com');
  });
});
