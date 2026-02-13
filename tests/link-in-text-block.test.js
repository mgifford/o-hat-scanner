import fs from 'fs';
import path from 'path';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(__dirname, '..');

let generateRunPage;
let analyzeResults;

describe('link-in-text-block accessibility (WCAG 2.1 SC 1.4.1)', () => {
    const runId = 'test-run-link-underline';
    const domainSlug = 'example-com';
    const runRelPath = path.join(domainSlug, runId);
    const runDir = path.join(ROOT, 'site', 'runs', runRelPath);
    const results = {
        startedAt: '2024-01-01T00:00:00Z',
        mode: 'ci',
        targets: ['http://example.com'],
        resultsByUrl: {
            'http://example.com/page1': {
                title: 'Test Page',
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

    test('links have text-decoration underline to meet WCAG 2.1 SC 1.4.1 (Use of Color)', () => {
        const stats = analyzeResults(results);
        generateRunPage(runId, runRelPath, results, stats);
        const htmlPath = path.join(runDir, 'index.html');
        const html = fs.readFileSync(htmlPath, 'utf-8');

        // Extract the CSS style block
        const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
        expect(styleMatch).toBeTruthy();
        
        const css = styleMatch[1];
        
        // Verify that the general link style has text-decoration: underline
        // This regex matches "a { ... text-decoration: underline; ... }"
        const linkStyleMatch = css.match(/\ba\s*\{[^}]*text-decoration:\s*underline[^}]*\}/);
        expect(linkStyleMatch).toBeTruthy();
        
        // Ensure links don't have text-decoration: none at the base level
        // This would violate WCAG 2.1 SC 1.4.1 (Use of Color)
        const linkNoDecoration = css.match(/\ba\s*\{[^}]*text-decoration:\s*none[^}]*\}/);
        expect(linkNoDecoration).toBeFalsy();
    });

    test('links in generated HTML are underlined by default', () => {
        const stats = analyzeResults(results);
        generateRunPage(runId, runRelPath, results, stats);
        const htmlPath = path.join(runDir, 'index.html');
        const html = fs.readFileSync(htmlPath, 'utf-8');

        // Check that the default link style includes underline
        expect(html).toMatch(/a\s*\{\s*color:\s*var\(--link\);\s*text-decoration:\s*underline;/);
    });
});
