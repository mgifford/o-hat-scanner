import fs from 'fs';
import path from 'path';

let generateTrendsPage;

describe('trends page generation', () => {
  const siteDir = path.join(process.cwd(), 'site');
  const trendsPath = path.join(siteDir, 'trends.html');

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    ({ generateTrendsPage } = await import('../scripts/generate-report.js'));
    fs.mkdirSync(siteDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(trendsPath, { force: true });
  });

  test('writes trends page with chart container and filters', () => {
    generateTrendsPage();
    const html = fs.readFileSync(trendsPath, 'utf-8');
    expect(html).toContain('O-Hat Trends');
    expect(html).toContain('targetSelect');
    expect(html).toContain('chart');
    expect(html).toContain('aggregate.csv');
  });

  test('includes legend container for multi-series and total line label', () => {
    generateTrendsPage();
    const html = fs.readFileSync(trendsPath, 'utf-8');
    expect(html).toContain('id="legend"');
    expect(html).toContain('Total');
  });
});
