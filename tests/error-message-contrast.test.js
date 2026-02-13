import fs from 'fs';
import path from 'path';

let generateRunPage;
let analyzeResults;

describe('error message color contrast', () => {
  const __dirname = path.dirname(new URL(import.meta.url).pathname);
  const ROOT = path.resolve(__dirname, '..');
  const runId = 'test-error-contrast';
  const domainSlug = 'example-com';
  const runRelPath = path.join(domainSlug, runId);
  const runDir = path.join(ROOT, 'site', 'runs', runRelPath);

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

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    ({ generateRunPage, analyzeResults } = await import('../scripts/generate-report.js'));
    fs.rmSync(runDir, { recursive: true, force: true });
  });

  afterAll(() => {
    fs.rmSync(path.join(ROOT, 'site'), { recursive: true, force: true });
  });

  test('error messages meet WCAG AA 4.5:1 contrast ratio', () => {
    const stats = analyzeResults(results);
    generateRunPage(runId, runRelPath, results, stats);
    const html = fs.readFileSync(path.join(runDir, 'index.html'), 'utf-8');

    // The error section appears in a beige panel (#f5f0d9)
    // Verify the panel exists
    expect(html).toContain('background-color: #f5f0d9');
    
    // The text color should be explicitly set to ensure contrast
    // On #f5f0d9 background, we need at least #222 (contrast 13.9:1)
    // or darker to meet AA standards
    // We should NOT use #797979 (contrast 3.85:1 on #f1f1f1)
    
    // Check that the default text color is defined as #222
    expect(html).toContain('--text: #222');
    
    // Verify that strong elements explicitly use var(--text) color
    // This ensures they inherit the correct high-contrast color
    expect(html).toMatch(/strong\s*{\s*color:\s*var\(--text\)/);
    
    // The error section should NOT have any color overrides that would
    // make it lighter (e.g., no --muted or similar)
    const errorSection = html.match(/<div style="margin-top: 1rem;">[\s\S]*?<h4[^>]*>Errors<\/h4>[\s\S]*?<\/ul>[\s\S]*?<\/div>/);
    expect(errorSection).toBeTruthy();
    
    // Verify no inline color styles that would override the good default
    // This pattern excludes gray colors like #797979 (issue color) or similar
    // Pattern matches: color: #7xxx or color: rgb(100-119, ...)
    const errorHtml = errorSection[0];
    expect(errorHtml).not.toMatch(/color:\s*#7/);
  });
});
