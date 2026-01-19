import fs from 'fs';
import path from 'path';

let generateRunPage;
let analyzeResults;

describe('mini trend accessibility', () => {
  const __dirname = path.dirname(new URL(import.meta.url).pathname);
  const ROOT = path.resolve(__dirname, '..');
  const runId = 'test-mini-trend-a11y';
  const domainSlug = 'test-domain';
  const runRelPath = path.join(domainSlug, runId);
  const runDir = path.join(ROOT, 'site', 'runs', runRelPath);

  const sampleResults = {
    runId,
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    toolVersion: 'test',
    mode: 'ci',
    config: {},
    targets: ['http://example.com'],
    resultsByUrl: {
      'http://example.com': { violations: [], title: 'Home' }
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

  test('uses <title> on SVG dots and avoids aria-label on <circle>', () => {
    const stats = analyzeResults(sampleResults);
    generateRunPage(runId, runRelPath, sampleResults, stats);
    const html = fs.readFileSync(path.join(runDir, 'index.html'), 'utf-8');

    // The script that draws the mini trend should not set aria-label on the circle elements
    expect(html).not.toContain("dot.setAttribute('aria-label'");

    // It should create a <title> element for each dot
    expect(html).toContain("createElementNS('http://www.w3.org/2000/svg', 'title')");
    expect(html).toContain("titleEl.textContent = 'Run ' + r.runId + ' total " );
  });
});
