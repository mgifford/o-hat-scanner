import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

let generateRunPage;
let generateMainIndex;
let generateTrendsPage;
let analyzeResults;

describe('HTML lang attribute accessibility (html-has-lang)', () => {
    const runId = 'test-lang-run';
    const domainSlug = 'example-com';
    const runRelPath = path.join(domainSlug, runId);
    const runDir = path.join(ROOT, 'site', 'runs', runRelPath);
    const siteDir = path.join(ROOT, 'site');
    
    const testResults = {
        runId: runId,
        startedAt: '2024-01-01T00:00:00Z',
        finishedAt: '2024-01-01T00:05:00Z',
        mode: 'ci',
        targets: ['http://example.com'],
        resultsByUrl: {
            'http://example.com/page1': {
                title: 'Test Page',
                violations: [
                    {
                        id: 'color-contrast',
                        impact: 'serious',
                        help: 'Elements must have sufficient color contrast',
                        helpUrl: 'https://dequeuniversity.com/rules/axe/4.11/color-contrast',
                        nodes: [
                            {
                                target: ['p.low-contrast'],
                                html: '<p class="low-contrast">Hard to read</p>',
                                failureSummary: 'Fix contrast ratio'
                            }
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
        generateTrendsPage = module.generateTrendsPage;
        analyzeResults = module.analyzeResults;
    });

    afterAll(() => {
        try {
            fs.rmSync(runDir, { recursive: true, force: true });
        } catch (err) {
            // Ignore cleanup errors
        }
        try {
            fs.rmSync(path.join(siteDir, 'index.html'), { force: true });
            fs.rmSync(path.join(siteDir, 'trends.html'), { force: true });
            fs.rmSync(path.join(siteDir, 'aggregate.csv'), { force: true });
        } catch (err) {
            // Ignore cleanup errors
        }
    });

    test('run page HTML must have lang="en" attribute for WCAG 2.1 Level A compliance', () => {
        // Generate a run page
        fs.mkdirSync(runDir, { recursive: true });
        const stats = analyzeResults(testResults);
        generateRunPage(runId, runRelPath, testResults, stats);
        
        const htmlPath = path.join(runDir, 'index.html');
        expect(fs.existsSync(htmlPath)).toBe(true);
        
        const html = fs.readFileSync(htmlPath, 'utf-8');
        
        // Verify <html> tag has lang attribute with value "en"
        expect(html).toMatch(/<html\s+[^>]*lang="en"[^>]*>/);
        
        // More specific: verify it appears near the start of the document
        const firstLines = html.split('\n').slice(0, 5).join('\n');
        expect(firstLines).toContain('lang="en"');
        
        // Ensure it's not lang="" or missing the value
        expect(html).not.toContain('lang=""');
    });

    test('main index page HTML must have lang="en" attribute', () => {
        // Create directory and results.json for the run
        fs.mkdirSync(runDir, { recursive: true });
        fs.writeFileSync(
            path.join(runDir, 'results.json'),
            JSON.stringify(testResults)
        );
        
        // Generate stats and create a summary
        const stats = analyzeResults(testResults);
        const summary = {
            runId: runId,
            target: testResults.targets[0],
            startedAt: testResults.startedAt,
            finishedAt: testResults.finishedAt,
            pagesScanned: 1,
            pagesWithIssues: 1,
            totalViolations: 1,
            criticalCount: 1,
            moderateCount: 0,
            reviewCount: 0,
            runRelPath: runRelPath
        };
        
        // Generate main index
        generateMainIndex([summary]);
        
        const indexPath = path.join(siteDir, 'index.html');
        expect(fs.existsSync(indexPath)).toBe(true);
        
        const html = fs.readFileSync(indexPath, 'utf-8');
        
        // Verify <html> tag has lang attribute
        expect(html).toMatch(/<html\s+[^>]*lang="en"[^>]*>/);
        
        // Verify it's in the document header area
        const firstLines = html.split('\n').slice(0, 5).join('\n');
        expect(firstLines).toContain('lang="en"');
    });

    test('trends page HTML must have lang="en" attribute', () => {
        // Create aggregate.csv with some test data
        const aggregatePath = path.join(siteDir, 'aggregate.csv');
        fs.mkdirSync(siteDir, { recursive: true });
        fs.writeFileSync(
            aggregatePath,
            'runId,completedAt,target,metricType,metricId,metricCount\n' +
            'test-run-1,2024-01-01T00:00:00Z,example.com,violation,color-contrast,5\n'
        );
        
        // Generate trends page
        generateTrendsPage();
        
        const trendsPath = path.join(siteDir, 'trends.html');
        expect(fs.existsSync(trendsPath)).toBe(true);
        
        const html = fs.readFileSync(trendsPath, 'utf-8');
        
        // Verify <html> tag has lang attribute
        expect(html).toMatch(/<html\s+[^>]*lang="en"[^>]*>/);
        
        // Verify it's in the document header area
        const firstLines = html.split('\n').slice(0, 5).join('\n');
        expect(firstLines).toContain('lang="en"');
    });

    test('all generated pages pass axe html-has-lang rule requirement', () => {
        // This test documents the axe rule being addressed
        // Rule: html-has-lang
        // WCAG: 3.1.1 Language of Page (Level A)
        // Reference: https://dequeuniversity.com/rules/axe/4.11/html-has-lang
        
        fs.mkdirSync(runDir, { recursive: true });
        const stats = analyzeResults(testResults);
        generateRunPage(runId, runRelPath, testResults, stats);
        
        const htmlPath = path.join(runDir, 'index.html');
        const html = fs.readFileSync(htmlPath, 'utf-8');
        
        // The axe rule html-has-lang checks:
        // 1. The <html> element must have a lang attribute
        // 2. The lang attribute must not be empty
        
        // Verify requirement 1: lang attribute exists
        const htmlTagMatch = html.match(/<html\s+[^>]*>/);
        expect(htmlTagMatch).not.toBeNull();
        expect(htmlTagMatch[0]).toContain('lang=');
        
        // Verify requirement 2: lang attribute has a value
        const langMatch = html.match(/lang="([^"]*)"/);
        expect(langMatch).not.toBeNull();
        expect(langMatch[1]).toBeTruthy(); // Value exists
        expect(langMatch[1].length).toBeGreaterThan(0); // Value is not empty
        expect(langMatch[1]).toBe('en'); // Value is 'en' specifically
    });

    test('static 404.html page has lang="en" attribute', () => {
        // The static 404 page should also have the lang attribute
        const static404Path = path.join(ROOT, 'static', '404.html');
        
        // Verify the file exists
        expect(fs.existsSync(static404Path)).toBe(true);
        
        const html = fs.readFileSync(static404Path, 'utf-8');
        
        // Verify <html> tag has lang attribute
        expect(html).toMatch(/<html\s+[^>]*lang="en"[^>]*>/);
    });
});
