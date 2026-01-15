import fs from 'fs';
import path from 'path';

let buildAggregateRows;
let generateAggregateCsv;

const results = {
  startedAt: '2024-01-01T00:00:00Z',
  targets: ['https://example.com'],
  config: {
    viewport: 'desktop',
    colorScheme: 'light',
    browser: 'chromium'
  },
  resultsByUrl: {
    'https://example.com/a': {
      violations: [
        {
          id: 'rule-a',
          impact: 'critical',
          tags: ['wcag111'],
          nodes: [{}, {}]
        },
        {
          id: 'rule-b',
          impact: 'moderate',
          tags: ['wcag21aa'],
          nodes: [{}]
        }
      ]
    }
  }
};

const pageStats = {
  pagesScanned: 1,
  pagesWithIssues: 1,
  automationCoverage: 100,
  mustFixCount: 2,
  goodToFixCount: 1,
  reviewCount: 0
};

describe('aggregate CSV', () => {
  const outPath = path.join(process.cwd(), 'site', 'aggregate.csv');

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    ({ buildAggregateRows, generateAggregateCsv } = await import('../scripts/generate-report.js'));
    fs.mkdirSync(path.join(process.cwd(), 'site'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(outPath, { force: true });
  });

  test('writes summary, rule, and wcag rows', () => {
    const rows = buildAggregateRows('run-1', results, pageStats);
    generateAggregateCsv(rows);
    const csv = fs.readFileSync(outPath, 'utf-8');
    expect(csv).toContain('metricType');
    expect(csv).toContain('summary,overall');
    expect(csv).toContain('rule,rule-a');
    expect(csv).toContain('wcag,wcag111');
    expect(csv).toContain('2'); // critical nodes
    expect(csv).toContain('1'); // moderate nodes
  });
});
