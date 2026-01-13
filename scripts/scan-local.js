import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const SITE_DIR = 'site';
const RUNS_DIR = path.join(SITE_DIR, 'runs');
const runId = `local-test-${Date.now()}`;
const runPath = path.join(RUNS_DIR, runId);

const urlsToScan = [
    'http://localhost:8082/standalone/index.html',
    'http://localhost:8082/standalone/demo-bad.html',
    'http://localhost:8082/standalone/page1.html',
    'http://localhost:8082/standalone/page2.html'
];

async function runLocalScan() {
    fs.mkdirSync(runPath, { recursive: true });
    
    const browser = await chromium.launch();
    const page = await browser.newPage();
    
    const resultsByUrl = {};
    const startedAt = new Date().toISOString();

    for (const url of urlsToScan) {
        console.log(`Scanning ${url}...`);
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
            
            // Inject axe-core and run scan
            await page.addScriptTag({ path: './assets/axe.min.js' });
            const results = await page.evaluate(() => {
                return new Promise((resolve) => {
                    window.axe.run(document, (error, results) => {
                        if (error) throw error;
                        resolve(results);
                    });
                });
            });
            
            resultsByUrl[url] = results;
        } catch (e) {
            console.error(`Error scanning ${url}: ${e.message}`);
            resultsByUrl[url] = { error: String(e), violations: [] };
        }
    }

    const finishedAt = new Date().toISOString();
    const results = {
        runId,
        startedAt,
        finishedAt,
        toolVersion: 'axe-4.10',
        mode: 'ci-local',
        config: { urls: urlsToScan },
        targets: urlsToScan,
        resultsByUrl
    };

    fs.writeFileSync(path.join(runPath, 'results.json'), JSON.stringify(results, null, 2));

    const summary = {
        runId,
        startedAt,
        pagesScanned: urlsToScan.length,
        pagesWithViolations: Object.values(resultsByUrl).filter(r => r.violations?.length > 0).length,
        totalViolations: Object.values(resultsByUrl).reduce((sum, r) => sum + (r.violations?.length || 0), 0)
    };
    fs.writeFileSync(path.join(runPath, 'summary.json'), JSON.stringify(summary, null, 2));

    console.log(`✓ Scan complete. Results saved to ${runPath}`);

    await browser.close();
}

runLocalScan().catch(err => {
    console.error('Scan failed:', err);
    process.exit(1);
});
