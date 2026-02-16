import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(__dirname, '..');

let generateRunPage;
let analyzeResults;
let browser;
let page;

describe('Logo link accessibility on run pages', () => {
    const runId = 'test-logo-link';
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
        
        // Generate the run page
        const stats = analyzeResults(results);
        generateRunPage(runId, runRelPath, results, stats);
        
        // Launch browser
        browser = await chromium.launch();
        page = await browser.newPage();
    });

    afterAll(async () => {
        await browser?.close();
        try {
            fs.rmSync(runDir, { recursive: true, force: true });
        } catch (err) {
            // Ignore cleanup errors
        }
    });

    test('logo link has discernible text (link-name)', async () => {
        const htmlPath = path.join(runDir, 'index.html');
        expect(fs.existsSync(htmlPath)).toBe(true);
        
        await page.goto(`file://${htmlPath}`);
        
        // Inject axe and run it on the page specifically for link-name rule
        const axePath = path.join(ROOT, 'node_modules', 'axe-core', 'axe.min.js');
        await page.addScriptTag({ path: axePath });
        
        const axeResults = await page.evaluate(async () => {
            return await window.axe.run({
                runOnly: ['link-name']
            });
        });
        
        // Check that there are no link-name violations
        expect(axeResults.violations).toHaveLength(0);
        
        // Additional check: verify the specific logo link has accessible text
        const logoAccessibleName = await page.evaluate(() => {
            const link = document.getElementById('homeLogo');
            return link ? link.textContent.trim() : null;
        });
        
        expect(logoAccessibleName).toBeTruthy();
        expect(logoAccessibleName).toContain('O-Hat Scanner');
    });

    test('logo link exists with correct text content', async () => {
        const htmlPath = path.join(runDir, 'index.html');
        await page.goto(`file://${htmlPath}`);
        
        // Check that the logo link exists and has text
        const logoExists = await page.locator('#homeLogo').count();
        expect(logoExists).toBe(1);
        
        // Check that it has text content
        const text = await page.locator('#homeLogo').textContent();
        expect(text).toContain('O-Hat Scanner');
        expect(text.trim()).not.toBe('');
    });

    test('logo link href is configured correctly', async () => {
        const htmlPath = path.join(runDir, 'index.html');
        await page.goto(`file://${htmlPath}`);
        
        // Check that homeLogo element exists with an href attribute
        const logoExists = await page.locator('#homeLogo').count();
        expect(logoExists).toBe(1);
        
        // Verify the href attribute exists
        const href = await page.locator('#homeLogo').getAttribute('href');
        expect(href).toBeTruthy();
        expect(typeof href).toBe('string');
        
        // The link should be functional - clicking it should navigate somewhere
        // In production, it points to the site's index page
        // The actual value depends on the runtime context (file:// vs http://)
    });

    test('logo link is keyboard accessible', async () => {
        const htmlPath = path.join(runDir, 'index.html');
        await page.goto(`file://${htmlPath}`);
        
        // Focus the link
        await page.locator('#homeLogo').focus();
        
        // Check it's focused
        const isFocused = await page.evaluate(() => {
            return document.activeElement.id === 'homeLogo';
        });
        expect(isFocused).toBe(true);
    });
});
