import fs from 'fs';
import path from 'path';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(__dirname, '..');

let generateRunPage;
let generateMainIndex;
let analyzeResults;

describe('HTML lang attribute accessibility', () => {
    const runId = 'test-lang-attr';
    const domainSlug = 'example-com';
    const runRelPath = path.join(domainSlug, runId);
    const runDir = path.join(ROOT, 'site', 'runs', runRelPath);
    const siteDir = path.join(ROOT, 'site');

    const mockResults = {
        startedAt: '2024-01-01T00:00:00Z',
        mode: 'ci',
        targets: ['http://example.com'],
        resultsByUrl: {
            'http://example.com/page1': {
                title: 'Test Page',
                violations: [
                    {
                        id: 'color-contrast',
                        impact: 'moderate',
                        help: 'Elements must have sufficient color contrast',
                        helpUrl: 'https://example.com/color-contrast',
                        nodes: [
                            { target: ['.text'], html: '<p class="text">Test</p>', failureSummary: 'Increase contrast' }
                        ]
                    }
                ]
            }
        }
    };

    beforeAll(async () => {
        process.env.NODE_ENV = 'test';
        const module = await import('../scripts/generate-report.js');
        generateRunPage = module.generateRunPage;
        generateMainIndex = module.generateMainIndex;
        analyzeResults = module.analyzeResults;
    });

    beforeEach(() => {
        // Clean up before each test
        fs.rmSync(siteDir, { recursive: true, force: true });
    });

    afterAll(() => {
        // Clean up after all tests
        fs.rmSync(siteDir, { recursive: true, force: true });
    });

    test('run page HTML element has lang="en" attribute', () => {
        const stats = analyzeResults(mockResults);
        generateRunPage(runId, runRelPath, mockResults, stats);

        const htmlPath = path.join(runDir, 'index.html');
        expect(fs.existsSync(htmlPath)).toBe(true);

        const html = fs.readFileSync(htmlPath, 'utf-8');
        
        // Check for lang attribute in html tag
        expect(html).toMatch(/<html[^>]+lang="en"/);
        
        // More specific check to ensure it's on the html element
        const htmlTagMatch = html.match(/<html[^>]*>/);
        expect(htmlTagMatch).not.toBeNull();
        expect(htmlTagMatch[0]).toContain('lang="en"');
    });

    test('index page HTML element has lang="en" attribute', () => {
        // Create a mock run to have something to list
        const stats = analyzeResults(mockResults);
        generateRunPage(runId, runRelPath, mockResults, stats);

        // Generate index page with proper summary structure
        const mockRunSummaries = [{
            runId,
            domain: domainSlug,
            runRelPath,
            startedAt: '2024-01-01T00:00:00Z',
            pagesScanned: 1,
            pagesWithViolations: 1,
            totalViolations: 1,
            target: 'http://example.com',
            mode: 'ci',
            viewport: 'desktop',
            colorScheme: 'light',
            browser: 'chromium'
        }];

        generateMainIndex(mockRunSummaries);

        const indexPath = path.join(siteDir, 'index.html');
        expect(fs.existsSync(indexPath)).toBe(true);

        const html = fs.readFileSync(indexPath, 'utf-8');
        
        // Check for lang attribute in html tag
        expect(html).toMatch(/<html[^>]+lang="en"/);
        
        // More specific check to ensure it's on the html element
        const htmlTagMatch = html.match(/<html[^>]*>/);
        expect(htmlTagMatch).not.toBeNull();
        expect(htmlTagMatch[0]).toContain('lang="en"');
    });

    test('trends page HTML element has lang="en" attribute', async () => {
        // Import generateTrendsPage
        const { generateTrendsPage } = await import('../scripts/generate-report.js');
        
        // Create necessary structure for trends page
        fs.mkdirSync(path.join(siteDir, 'runs', domainSlug), { recursive: true });
        
        // Create aggregate.csv for trends
        const csvContent = 'runId,startedAt,finishedAt,mode,targets,pagesScanned,pagesWithViolations,totalViolations\n' +
            `${runId},2024-01-01T00:00:00Z,2024-01-01T00:01:00Z,ci,http://example.com,1,1,1\n`;
        fs.writeFileSync(path.join(siteDir, 'aggregate.csv'), csvContent);

        // Generate trends page
        generateTrendsPage();

        const trendsPath = path.join(siteDir, 'trends.html');
        expect(fs.existsSync(trendsPath)).toBe(true);
        
        const html = fs.readFileSync(trendsPath, 'utf-8');
        
        // Check for lang attribute in html tag
        expect(html).toMatch(/<html[^>]+lang="en"/);
        
        // More specific check to ensure it's on the html element
        const htmlTagMatch = html.match(/<html[^>]*>/);
        expect(htmlTagMatch).not.toBeNull();
        expect(htmlTagMatch[0]).toContain('lang="en"');
    });

    test('all HTML pages meet html-has-lang axe rule requirement', () => {
        // This test documents what axe-core checks for html-has-lang rule:
        // The <html> element must have a lang attribute
        
        const stats = analyzeResults(mockResults);
        generateRunPage(runId, runRelPath, mockResults, stats);

        const htmlPath = path.join(runDir, 'index.html');
        const html = fs.readFileSync(htmlPath, 'utf-8');

        // Parse the HTML element
        const htmlMatch = html.match(/<html([^>]*)>/);
        expect(htmlMatch).not.toBeNull();
        
        const attributes = htmlMatch[1];
        
        // Verify lang attribute exists and has a value
        const langMatch = attributes.match(/lang="([^"]*)"/);
        expect(langMatch).not.toBeNull();
        expect(langMatch[1]).toBeTruthy(); // lang value should not be empty
        expect(langMatch[1]).toBe('en'); // Should be 'en' specifically
    });
});
