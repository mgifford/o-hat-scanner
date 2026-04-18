/**
 * Test: scrollable-region-focusable
 *
 * Verifies that scrollable `.fallback-prompt-text` regions have `tabindex="0"`
 * so they can be reached and scrolled by keyboard users.
 * Addresses axe rule: scrollable-region-focusable
 * See: https://dequeuniversity.com/rules/axe/4.11/scrollable-region-focusable
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

let generateRunPage;
let analyzeResults;

describe('scrollable-region-focusable: fallback-prompt-text keyboard access', () => {
    const runId = 'test-scrollable-focusable';
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
        fs.mkdirSync(runDir, { recursive: true });
    });

    afterAll(() => {
        try {
            fs.rmSync(runDir, { recursive: true, force: true });
        } catch (err) {
            // Ignore cleanup errors
        }
    });

    test('fallback-prompt-text elements have tabindex="0" for keyboard scroll access', () => {
        const stats = analyzeResults(results);
        generateRunPage(runId, runRelPath, results, stats);

        const htmlPath = path.join(runDir, 'index.html');
        expect(fs.existsSync(htmlPath)).toBe(true);

        const html = fs.readFileSync(htmlPath, 'utf-8');

        // The scrollable prompt text divs must be keyboard-focusable via tabindex="0"
        // This satisfies the axe rule: scrollable-region-focusable
        expect(html).toContain('tabindex="0"');
        expect(html).toMatch(/class="fallback-prompt-text"[^>]*tabindex="0"|tabindex="0"[^>]*class="fallback-prompt-text"/);
    });

    test('fallback-prompt-text elements have a focus style defined', () => {
        const stats = analyzeResults(results);
        generateRunPage(runId, runRelPath, results, stats);

        const htmlPath = path.join(runDir, 'index.html');
        const html = fs.readFileSync(htmlPath, 'utf-8');

        // A :focus style must exist for .fallback-prompt-text so focus is visible (WCAG 2.4.7)
        expect(html).toContain('.fallback-prompt-text:focus');
    });

    test('fallback-prompt-text elements have role="region" and aria-label for screen reader context', () => {
        const stats = analyzeResults(results);
        generateRunPage(runId, runRelPath, results, stats);

        const htmlPath = path.join(runDir, 'index.html');
        const html = fs.readFileSync(htmlPath, 'utf-8');

        // The scrollable area should carry a region role + label so screen readers
        // understand what the focusable element is before the user scrolls into it.
        expect(html).toContain('role="region"');
        expect(html).toMatch(/aria-label="[^"]+"/);
    });
});
