import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKFLOW_PATH = path.join(__dirname, '../.github/workflows/a11y-scan_gh.yml');

function parseSimpleYaml(content) {
  // Simple extraction helpers — avoids a YAML dependency in tests
  return content;
}

describe('a11y-scan_gh.yml workflow configuration', () => {
  let workflowContent;

  beforeAll(() => {
    workflowContent = fs.readFileSync(WORKFLOW_PATH, 'utf8');
  });

  test('workflow file exists', () => {
    expect(fs.existsSync(WORKFLOW_PATH)).toBe(true);
  });

  test('scans the GitHub Pages index URL', () => {
    expect(workflowContent).toContain('https://mgifford.github.io/o-hat-scanner/');
  });

  test('scans the trends page URL', () => {
    expect(workflowContent).toContain('https://mgifford.github.io/o-hat-scanner/trends.html');
  });

  test('scans the 404 page URL', () => {
    expect(workflowContent).toContain('https://mgifford.github.io/o-hat-scanner/404.html');
  });

  test('has a URL discovery step that fetches the index page with curl', () => {
    expect(workflowContent).toContain('curl');
    expect(workflowContent).toContain('discover');
    expect(workflowContent).toContain('LATEST_RUN');
  });

  test('scanner step uses dynamically discovered URLs from prior step', () => {
    expect(workflowContent).toContain('steps.discover.outputs.urls');
  });

  test('URL discovery step emits a warning when no run page is found', () => {
    expect(workflowContent).toContain('::warning::');
  });

  test('has a monthly schedule trigger', () => {
    // 1st of every month
    expect(workflowContent).toMatch(/cron:\s*['"]0 \d+ 1 \* \*['"]/);
  });

  test('has a workflow_run trigger pointing to the a11y-scan workflow', () => {
    expect(workflowContent).toContain('workflow_run');
    expect(workflowContent).toContain('a11y-scan');
  });

  test('has a workflow_dispatch trigger for manual runs', () => {
    expect(workflowContent).toContain('workflow_dispatch');
  });

  test('uses github/accessibility-scanner action', () => {
    expect(workflowContent).toContain('github/accessibility-scanner');
  });

  test('only runs workflow_run jobs on successful completion', () => {
    expect(workflowContent).toContain("conclusion == 'success'");
  });

  test('does not contain unsupported glob URL patterns', () => {
    // github/accessibility-scanner does not support URL globs like runs/*
    expect(workflowContent).not.toContain('runs/*');
  });
});

describe('URL discovery regex matches generated index HTML structure', () => {
  // Verify the grep regex used in the workflow correctly extracts run page links
  // from the HTML that generate-report.js actually produces.
  const GREP_PATTERN = /runs\/[^"]+\/index\.html/;

  test('regex matches a standard run page link', () => {
    const sampleHtml = '<a class="view-link" href="runs/example-com/2024-01-15T10-30/index.html" aria-label="Open example.com">Open</a>';
    const match = sampleHtml.match(GREP_PATTERN);
    expect(match).not.toBeNull();
    expect(match[0]).toBe('runs/example-com/2024-01-15T10-30/index.html');
  });

  test('regex does not match archived run links that point to zip files', () => {
    const sampleHtml = '<a class="view-link" href="archive/runs-2024-01.zip" aria-label="Download archive">Download ZIP</a>';
    expect(sampleHtml.match(GREP_PATTERN)).toBeNull();
  });

  test('regex does not match glob patterns like runs/*', () => {
    expect('runs/*'.match(GREP_PATTERN)).toBeNull();
  });
});
