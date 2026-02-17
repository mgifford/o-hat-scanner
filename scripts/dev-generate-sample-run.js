// Generate a sample run page under site/runs/test-domain/test-quality-run
import path from 'path';
import fs from 'fs';

const { generateRunPage, analyzeResults } = await import('./generate-report.js');

const runId = 'test-quality-run';
const domainSlug = 'test-domain';
const runRelPath = path.join(domainSlug, runId);

const results = {
  startedAt: new Date().toISOString(),
  finishedAt: new Date().toISOString(),
  toolVersion: 'dev',
  mode: 'ci',
  targets: ['http://example.com'],
  resultsByUrl: {
    'http://example.com/page1': {
      title: 'Sample Page',
      violations: [
        {
          id: 'image-alt',
          impact: 'moderate',
          help: 'Images must have alternate text.',
          helpUrl: 'https://example.com/image-alt',
          nodes: [
            { target: ['img.hero'], html: '<img src="hero.png">', failureSummary: 'Add alt text' }
          ]
        }
      ]
    }
  }
};

// Ensure site directory exists (generateRunPage will create nested paths)
fs.mkdirSync(path.join(process.cwd(), 'site'), { recursive: true });

const stats = analyzeResults(results);
generateRunPage(runId, runRelPath, results, stats);

console.log('Wrote sample report to', path.join('site', 'runs', runRelPath, 'index.html'));
