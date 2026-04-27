import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

let generateRunPage;
let analyzeResults;

describe('Run page heading order (heading-order axe rule)', () => {
    const runId = 'test-run-heading-order';
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
        try {
            fs.rmSync(runDir, { recursive: true, force: true });
        } catch (err) {
            // Ignore cleanup errors
        }
    });

    test('heading levels do not skip levels (h1 must be followed by h2 before h3/h4)', () => {
        fs.mkdirSync(runDir, { recursive: true });
        const stats = analyzeResults(results);
        generateRunPage(runId, runRelPath, results, stats);
        const htmlPath = path.join(runDir, 'index.html');
        const html = fs.readFileSync(htmlPath, 'utf-8');

        // Extract visible (non-modal) heading tags in document order.
        // Modals use display:none and are excluded from axe heading-order checks.
        // Strip out modal sections before extracting headings.
        const withoutModals = html.replace(/<div[^>]+class="modal"[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/g, '');

        const headingMatches = [...withoutModals.matchAll(/<h([1-6])[^>]*>/gi)];
        const levels = headingMatches.map(m => parseInt(m[1], 10));

        expect(levels.length).toBeGreaterThan(0);

        // Heading levels must only increase by one at a time
        for (let i = 1; i < levels.length; i++) {
            const prev = levels[i - 1];
            const curr = levels[i];
            // Heading levels may decrease by any amount (going back up is valid)
            // but may only increase by 1 at a time
            if (curr > prev) {
                expect(curr - prev).toBe(1);
            }
        }
    });

    test('first heading in main content is h1', () => {
        const htmlPath = path.join(runDir, 'index.html');
        const html = fs.readFileSync(htmlPath, 'utf-8');

        const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/);
        expect(mainMatch).not.toBeNull();

        const firstHeading = mainMatch[1].match(/<h([1-6])[^>]*>/i);
        expect(firstHeading).not.toBeNull();
        // The first heading inside main should not be h4 (or deeper) directly
        // It should start at a high level (h2 or above after the page h1 in the header)
        const level = parseInt(firstHeading[1], 10);
        expect(level).toBeLessThanOrEqual(2);
    });

    test('summary cards use h2 headings (not h4)', () => {
        const htmlPath = path.join(runDir, 'index.html');
        const html = fs.readFileSync(htmlPath, 'utf-8');

        // Summary cards must use h2 for accessible heading order
        expect(html).toContain('<h2>Pages scanned</h2>');
        expect(html).toContain('<h2>Pages with issues</h2>');
        expect(html).toContain('<h2>Must Fix</h2>');
        expect(html).toContain('<h2>Good to Fix</h2>');
        expect(html).toContain('<h2>Manual review</h2>');

        // h4 must not be used for summary card labels
        expect(html).not.toContain('<h4>Pages scanned</h4>');
        expect(html).not.toContain('<h4>Pages with issues</h4>');
        expect(html).not.toContain('<h4>Must Fix</h4>');
        expect(html).not.toContain('<h4>Good to Fix</h4>');
        expect(html).not.toContain('<h4>Manual review</h4>');
    });

    test('insights section and dedupe section are hidden by default (progressive enhancement)', () => {
        const htmlPath = path.join(runDir, 'index.html');
        const html = fs.readFileSync(htmlPath, 'utf-8');

        // Both sections must have hidden attribute so their h3/h4 headings are hidden
        // before JavaScript reveals them - prevents heading order violations when
        // the page is scanned in a no-JS or static-HTML context.
        expect(html).toMatch(/<section[^>]+id="insights-section"[^>]+hidden/);
        expect(html).toMatch(/<section[^>]+id="dedupe-section"[^>]+hidden/);
    });

    test('dedupe sub-section h4 headings are inside the hidden dedupe section (not exposed without JS)', () => {
        const htmlPath = path.join(runDir, 'index.html');
        const html = fs.readFileSync(htmlPath, 'utf-8');

        // The h4 "Deduped Groups" heading must be inside a hidden container so it
        // does not appear in the heading outline before JavaScript reveals it with
        // the parent h3 "Dedupe and Patterns" already visible.
        // Regression test for: heading-order axe rule violation on run report pages.
        const dedupeGroupsMatch = html.match(/<div[^>]+id="dedupe-groups-section"([^>]*)>/);
        expect(dedupeGroupsMatch).not.toBeNull();
        expect(dedupeGroupsMatch[1]).toContain('hidden');

        const dedupeClustersMatch = html.match(/<div[^>]+id="dedupe-clusters-section"([^>]*)>/);
        expect(dedupeClustersMatch).not.toBeNull();
        expect(dedupeClustersMatch[1]).toContain('hidden');

        const dedupeActionsMatch = html.match(/<div[^>]+id="dedupe-actions-section"([^>]*)>/);
        expect(dedupeActionsMatch).not.toBeNull();
        expect(dedupeActionsMatch[1]).toContain('hidden');
    });

    test('heading order is valid on page with scan errors (regression for h4 Deduped Groups)', () => {
        const runIdErrors = 'test-run-heading-order-errors';
        const runRelPathErrors = path.join(domainSlug, runIdErrors);
        const runDirErrors = path.join(ROOT, 'site', 'runs', runRelPathErrors);
        fs.mkdirSync(runDirErrors, { recursive: true });

        const resultsWithErrors = {
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
                },
                'http://example.com/error-page': {
                    error: 'Navigation timeout after 30000ms'
                }
            }
        };

        const statsWithErrors = analyzeResults(resultsWithErrors);
        generateRunPage(runIdErrors, runRelPathErrors, resultsWithErrors, statsWithErrors);

        const html = fs.readFileSync(path.join(runDirErrors, 'index.html'), 'utf-8');

        // Strip modals and script/style blocks before checking heading order.
        // Use string-based stripping instead of regex to avoid CodeQL tag-filter warnings.
        let withoutNoise = html.replace(/<div[^>]+class="modal"[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/g, '');
        // Remove <script> blocks by splitting on the tag boundaries
        withoutNoise = withoutNoise.split('<script').map((part, i) => {
            if (i === 0) return part;
            const end = part.indexOf('</script>');
            return end >= 0 ? part.slice(end + '</script>'.length) : '';
        }).join('');
        // Remove <style> blocks by splitting on the tag boundaries
        withoutNoise = withoutNoise.split('<style').map((part, i) => {
            if (i === 0) return part;
            const end = part.indexOf('</style>');
            return end >= 0 ? part.slice(end + '</style>'.length) : '';
        }).join('');

        const headingMatches = [...withoutNoise.matchAll(/<h([1-6])[^>]*>/gi)];
        const levels = headingMatches.map(m => parseInt(m[1], 10));

        expect(levels.length).toBeGreaterThan(0);

        for (let i = 1; i < levels.length; i++) {
            const prev = levels[i - 1];
            const curr = levels[i];
            if (curr > prev) {
                expect(curr - prev).toBe(1);
            }
        }

        // The Errors heading (from renderErrors) must not use h4 since the debug
        // section has no parent h3 of its own - it should be h3.
        expect(html).not.toContain('<h4 style="margin-bottom: 0.5rem;">Errors</h4>');

        try {
            fs.rmSync(runDirErrors, { recursive: true, force: true });
        } catch (cleanupError) { /* Cleanup failure is non-critical for test execution */ }
    });
});
