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
