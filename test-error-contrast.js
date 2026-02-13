import fs from 'fs';
import path from 'path';
import { generateRunPage, analyzeResults } from './scripts/generate-report.js';

const runId = 'test-error-color';
const domainSlug = 'example-com';
const runRelPath = path.join(domainSlug, runId);
const runDir = path.join('site', 'runs', runRelPath);

const results = {
  startedAt: '2024-01-01T00:00:00Z',
  mode: 'ci',
  targets: ['http://example.com'],
  config: {},
  resultsByUrl: {
    'http://example.com/page1': { 
      title: 'Page 1', 
      violations: [],
      error: 'File not found'
    },
    'http://example.com/page2': { 
      title: 'Page 2', 
      violations: []
    }
  }
};

fs.rmSync(runDir, { recursive: true, force: true });
const stats = analyzeResults(results);
generateRunPage(runId, runRelPath, results, stats);

const html = fs.readFileSync(path.join(runDir, 'index.html'), 'utf-8');

// Find the error section
const errorMatch = html.match(/<h4[^>]*>Errors<\/h4>[\s\S]*?<\/ul>/);
if (errorMatch) {
  console.log('Found error section:');
  console.log(errorMatch[0]);
}

// Check for strong tag styling
const strongMatch = html.match(/strong\s*{[^}]*}/g);
if (strongMatch) {
  console.log('\nFound strong CSS rules:');
  strongMatch.forEach(rule => console.log(rule));
}

// Check for panel text color on the debug panel
const debugPanel = html.match(/<div class="panel" style="[^"]*background-color:\s*#f5f0d9[^"]*">/);
if (debugPanel) {
  console.log('\nFound debug panel:', debugPanel[0]);
}
