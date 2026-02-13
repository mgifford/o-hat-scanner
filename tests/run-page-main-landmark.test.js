import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

let generateRunPage;
let analyzeResults;

describe('Run page main landmark (landmark-one-main)', () => {
    const runId = 'test-run-landmark';
    const domainSlug = 'example-com';
    const runRelPath = path.join(domainSlug, runId);
    const runDir = path.join(ROOT, 'site', 'runs', runRelPath);
    const results = {
        startedAt: '2024-01-01T00:00:00Z',
        mode: 'ci',
        targets: ['http://example.com'],
        resultsByUrl: {
            'http://example.com/page1': {
                title: 'Page One',
                violations: [
                    {
                        id: 'color-contrast',
                        impact: 'critical',
                        help: 'Elements must have sufficient color contrast',
                        helpUrl: 'https://dequeuniversity.com/rules/axe/4.11/color-contrast',
                        nodes: [
                            { target: ['.text'], html: '<p class="text">Low contrast</p>', failureSummary: 'Increase contrast' }
                        ]
                    }
                ]
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

    test('run page must have a main landmark element', () => {
        const stats = analyzeResults(results);
        generateRunPage(runId, runRelPath, results, stats);
        const htmlPath = path.join(runDir, 'index.html');
        expect(fs.existsSync(htmlPath)).toBe(true);
        
        const html = fs.readFileSync(htmlPath, 'utf-8');
        
        // Check that the page contains a <main> element
        // This addresses the axe rule landmark-one-main which requires
        // "Document should have one main landmark"
        expect(html).toMatch(/<main\b/);
        
        // Verify it has an id="main" for skip-to-main functionality
        expect(html).toMatch(/<main[^>]*\bid=["']main["']/);
    });

    test('main landmark should wrap primary content', () => {
        const stats = analyzeResults(results);
        generateRunPage(runId, runRelPath, results, stats);
        const htmlPath = path.join(runDir, 'index.html');
        const html = fs.readFileSync(htmlPath, 'utf-8');
        
        // Extract the main element content
        const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/);
        expect(mainMatch).not.toBeNull();
        
        // Main should contain the key content sections
        const mainContent = mainMatch[1];
        expect(mainContent).toContain('Search issues');
        expect(mainContent).toContain('Issues grouped by impact');
    });

    test('skip link should point to main landmark', () => {
        const stats = analyzeResults(results);
        generateRunPage(runId, runRelPath, results, stats);
        const htmlPath = path.join(runDir, 'index.html');
        const html = fs.readFileSync(htmlPath, 'utf-8');
        
        // The skip link should already exist and point to #main
        expect(html).toContain('href="#main"');
        expect(html).toContain('Skip to main content');
    });
});
