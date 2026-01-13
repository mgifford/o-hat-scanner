const { chromium } = require('playwright');
const path = require('path');
const { spawn } = require('child_process');

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
    
    // Check gate passes
    const warning = await page.textContent('#warning');
    expect(warning).toContain('SECURITY WARNING'); 
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

    // Click start
    await page.click('#startBtn');
    
    // Wait for "Scan Complete"
    await page.waitForFunction(() => document.getElementById('status').innerText.includes('Scan Complete'), { timeout: 30000 });
    
    // Check results
    const results = await page.innerHTML('#results');
    expect(results).toContain('demo-bad.html');
    expect(results).toContain('violations');
    
    // Verify specific violations we put in valid-bad.html
    // We expect "Images must have alternative text" but innerText might be summary
    // The UI shows "X violations"
    const violationCountText = await page.textContent('.error');
    const count = parseInt(violationCountText);
    expect(count).toBeGreaterThan(5); // We put ~7 errors
  }, 60000);
  
  test('Prevents cross-origin scanning', async () => {
    await page.goto(`http://localhost:${PORT}/standalone/a11y-scan.html?token=A11Y-SECRET`);
    
    await page.selectOption('#sourceType', 'custom');
    await page.fill('#customUrlList', 'https://example.com'); // External domain
    
    await page.click('#startBtn');
    
    await page.waitForFunction(() => document.getElementById('results').innerText.length > 0);
    
    const results = await page.innerText('#results');
    expect(results).toContain('Error: Skipping cross-origin URL');
  });
});
