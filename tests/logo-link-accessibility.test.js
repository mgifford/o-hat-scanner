import fs from 'fs';
import path from 'path';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(__dirname, '..');

let generateRunPage;
let analyzeResults;

describe('logo/home link accessibility on run pages', () => {
    const runId = 'test-run-logo';
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

    test('run page header must have a home/logo link with accessible text', () => {
        const stats = analyzeResults(results);
        generateRunPage(runId, runRelPath, results, stats);
        const htmlPath = path.join(runDir, 'index.html');
        expect(fs.existsSync(htmlPath)).toBe(true);
        const html = fs.readFileSync(htmlPath, 'utf-8');

        // The header should have a link that serves as a logo/home link
        // It must have discernible text (not empty, not just an image without alt text)
        // Common patterns: text content, aria-label, or image with alt text
        
        // Check that the site logo link exists in the header
        const headerMatch = html.match(/<header[\s\S]*?<\/header>/i);
        expect(headerMatch).toBeTruthy();
        const headerHTML = headerMatch[0];

        // Look for the site-logo link in the header
        const siteLogoPattern = /<a[^>]*class=["'][^"']*site-logo[^"']*["'][^>]*>([\s\S]*?)<\/a>/i;
        const match = headerHTML.match(siteLogoPattern);
        
        // The site logo link should exist
        expect(match).toBeTruthy();

        if (match) {
            const linkTag = match[0];
            const linkContent = match[1];
            
            // Check for visible text content (non-whitespace)
            const hasVisibleText = linkContent.trim().length > 0 && 
                                  !linkContent.match(/^\s*$/);
            
            // Check for aria-label
            const hasAriaLabel = linkTag.includes('aria-label=');
            
            // Check for title attribute
            const hasTitle = linkTag.includes('title=');
            
            // At least one method of providing accessible text must be present
            expect(hasVisibleText || hasAriaLabel || hasTitle).toBe(true);
            
            // The visible text should be meaningful (contains alphanumeric or recognizable symbols)
            if (hasVisibleText) {
                expect(linkContent).toMatch(/[a-zA-Z0-9🎩]/);
                // Should not be empty or just whitespace
                expect(linkContent.trim().length).toBeGreaterThan(0);
            }
        }
    });

    test('logo/home link must not be empty', () => {
        const stats = analyzeResults(results);
        generateRunPage(runId, runRelPath, results, stats);
        const htmlPath = path.join(runDir, 'index.html');
        const html = fs.readFileSync(htmlPath, 'utf-8');

        // Check there are no empty links (which would fail axe link-name rule)
        // Empty links are <a href="..."></a> or <a href="..."> </a> (only whitespace)
        const emptyLinkPattern = /<a[^>]*href=["'][^"']*["'][^>]*>\s*<\/a>/gi;
        const emptyLinks = html.match(emptyLinkPattern) || [];
        
        // Filter out links that have aria-label or other accessible name
        const trulyEmptyLinks = emptyLinks.filter(link => {
            return !link.includes('aria-label=') && 
                   !link.includes('aria-labelledby=') &&
                   !link.includes('title=');
        });

        expect(trulyEmptyLinks.length).toBe(0);
    });
});
