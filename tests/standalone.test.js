import { chromium } from 'playwright';
import path from 'path';
import { spawn } from 'child_process';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

// Integration test that:
// 1. Starts a local server (simulating GitHub Pages)
// 2. Uses Playwright to visit the Standalone Scanner (simulating a user)
// 3. Runs a scan against the demo-bad.html page
// 4. Verifies violations are found

let server;
let browser;
let page;
const PORT = 8081;

describe('Standalone Scanner E2E', () => {
  beforeAll(async () => {
    // Start http-server serving project root
    server = spawn('npx', ['http-server', '.', '-p', PORT], {
      stdio: 'ignore',
      shell: true
    });
    
    // Give server time to start
    await new Promise(resolve => setTimeout(resolve, 2000));

    browser = await chromium.launch();
  });

  afterAll(async () => {
    if (browser) await browser.close();
    if (server) server.kill();
  });

  beforeEach(async () => {
    page = await browser.newPage();
  });

  test('Page loads and accepts token', async () => {
    await page.goto(`http://localhost:${PORT}/standalone/a11y-scan.html?token=A11Y-SECRET`);
    
    const warning = await page.textContent('#warning');
    expect(warning).toContain('SECURITY WARNING');
    const gateVisible = await page.isVisible('#gate-screen');
    expect(gateVisible).toBe(false);
  });

  test('Scans demo-bad.html and correctly reports errors', async () => {
    await page.goto(`http://localhost:${PORT}/standalone/a11y-scan.html?token=A11Y-SECRET`);
    
    // Configure scanner
    await page.selectOption('#sourceType', 'custom');
    
    // Note: Path is relative to the "site root" which is project root in our test server
    // So http://localhost:8081/standalone/demo-bad.html
    const targetUrl = `http://localhost:${PORT}/standalone/demo-bad.html`;
    await page.fill('#customUrlList', targetUrl);
    
    // Update axe path to point to root assets since our test server serves root
    // The default in HTML is "assets/axe.min.js", which relative to "standalone/a11y-scan.html" 
    // resolves to "standalone/assets/axe.min.js" which DOES NOT EXIST.
    // We must point it to "../assets/axe.min.js" OR ensuring assets/ is copied.
    // Let's fix the input in the UI to match our file structure:
    await page.fill('#axePath', '../assets/axe.min.js');

    await page.click('#startBtn');
    
    await page.waitForFunction(() => document.getElementById('status').innerText.includes('Scan Complete'), { timeout: 30000 });
    
    const results = await page.innerHTML('#results');
    expect(results).toContain('demo-bad.html');
    expect(results).toContain('Violation rules');

    const violationNodeCount = await page.$eval('#results table tbody tr td:nth-child(3)', el => parseInt(el.textContent, 10));
    expect(violationNodeCount).toBeGreaterThan(5);
  }, 60000);
  
  test('Prevents cross-origin scanning', async () => {
    await page.goto(`http://localhost:${PORT}/standalone/a11y-scan.html?token=A11Y-SECRET`);
    
    await page.selectOption('#sourceType', 'custom');
    await page.fill('#customUrlList', 'https://example.com');
    await page.fill('#axePath', '../assets/axe.min.js');
    await page.click('#startBtn');
    
    await page.waitForFunction(() => document.getElementById('results').innerText.length > 0);
    
    const results = await page.innerText('#results');
    expect(results.toLowerCase()).toContain('cross-origin');
  });

  test('Allows stop to halt remaining pages', async () => {
    await page.goto(`http://localhost:${PORT}/standalone/a11y-scan.html?token=A11Y-SECRET`);
    await page.selectOption('#sourceType', 'custom');
    await page.fill('#customUrlList', [
      `http://localhost:${PORT}/standalone/demo-bad.html`,
      `http://localhost:${PORT}/standalone/demo-bad.html?dup=1`
    ].join('\n'));
    await page.fill('#axePath', '../assets/axe.min.js');
    await page.click('#startBtn');
    await page.waitForTimeout(500);
    await page.click('#stopBtn');

    await page.waitForFunction(() => document.getElementById('status').innerText.toLowerCase().includes('stopped'));
    const scannedCount = await page.$eval('#scannedCount', el => parseInt(el.textContent, 10));
    expect(scannedCount).toBeLessThanOrEqual(1);
  }, 30000);

  test('Honors timeout setting per page', async () => {
    await page.goto(`http://localhost:${PORT}/standalone/a11y-scan.html?token=A11Y-SECRET`);
    await page.selectOption('#sourceType', 'custom');
    await page.fill('#customUrlList', `http://localhost:${PORT}/standalone/demo-bad.html`);
    await page.fill('#axePath', '../assets/axe.min.js');
    await page.fill('#timeoutMs', '5');
    await page.click('#startBtn');

    await page.waitForFunction(() => document.getElementById('results').innerText.length > 0);
    const results = await page.innerText('#results');
    expect(results.toLowerCase()).toContain('timed out');
  }, 30000);

  test('Includes passes and incomplete when toggled', async () => {
    await page.goto(`http://localhost:${PORT}/standalone/a11y-scan.html?token=A11Y-SECRET`);
    await page.selectOption('#sourceType', 'custom');
    const targetUrl = `http://localhost:${PORT}/standalone/demo-bad.html`;
    await page.fill('#customUrlList', targetUrl);
    await page.fill('#axePath', '../assets/axe.min.js');
    await page.check('#includePasses');
    await page.check('#includeIncomplete');
    await page.click('#startBtn');

    await page.waitForFunction(() => document.getElementById('status').innerText.includes('Scan Complete'), { timeout: 30000 });
    const runData = await page.evaluate(() => window.__lastRun);
    expect(runData.config.includePasses).toBe(true);
    expect(runData.config.includeIncomplete).toBe(true);
    expect(runData.resultsByUrl[targetUrl].passes.length).toBeGreaterThan(0);
    expect(runData.resultsByUrl[targetUrl].incomplete.length).toBeGreaterThanOrEqual(0);
  }, 60000);
});
