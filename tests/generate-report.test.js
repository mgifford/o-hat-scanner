import fs from 'fs';
import path from 'path';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(__dirname, '..');

let generateRunPage;
let analyzeResults;

describe('generate-report run page', () => {
    const runId = 'test-run-report';
    const runDir = path.join(ROOT, 'site', 'runs', runId);
    const results = {
        startedAt: '2024-01-01T00:00:00Z',
        mode: 'ci',
        targets: ['http://example.com'],
        resultsByUrl: {
            'http://example.com/page1': {
                title: 'Page One',
                violations: [
                    {
                        id: 'clickable-elements',
                        impact: 'critical',
                        help: 'Clickable elements must have accessible labels.',
                        helpUrl: 'https://example.com/clickable-elements',
                        nodes: [
                            { target: ['button.bad'], html: '<button></button>', failureSummary: 'Add accessible name' },
                            { target: ['div.action'], html: '<div role="button"></div>', failureSummary: 'Add role and label' }
                        ]
                    }
                ]
            },
            'http://example.com/page2': {
                title: 'Page Two',
                violations: [
                    {
                        id: 'image-alt',
                        impact: 'moderate',
                        help: 'Images must have alternative text.',
                        helpUrl: 'https://example.com/image-alt',
                        nodes: [
                            { target: ['img.hero'], html: '<img src="hero.png">', failureSummary: 'Add alt text' }
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

    test('renders run page with search, top pages, and severity groups', () => {
        const stats = analyzeResults(results);
        generateRunPage(runId, results, stats);
        const htmlPath = path.join(runDir, 'index.html');
        expect(fs.existsSync(htmlPath)).toBe(true);
        const html = fs.readFileSync(htmlPath, 'utf-8');

        expect(html).toContain('Search issues');
        expect(html).toContain('Issues grouped by impact');
        expect(html).toContain('Top pages to review');
        expect(html).toContain('Must Fix');
        expect(html).toContain('Good to Fix');
        expect(html).toContain('Manual review');
        expect(html).toContain('clickable-elements');
        expect(html).toContain('image-alt');
    });

    test('renders clickable URLs and correct crawled count', () => {
        const stats = analyzeResults(results);
        generateRunPage(runId, results, stats);
        const htmlPath = path.join(runDir, 'index.html');
        const html = fs.readFileSync(htmlPath, 'utf-8');

        // Top pages links should be anchors opening new tabs
        expect(html).toContain('<a href="http://example.com/page1" target="_blank" rel="noopener">');

        // Pages crawled should reflect processed results count (2), not targets length (1)
        expect(html).toContain('Pages crawled: 2');

        // Node URLs should also be clickable
        expect(html).toContain('<a href="http://example.com/page1" target="_blank" rel="noopener">http://example.com/page1</a>');
    });
});
