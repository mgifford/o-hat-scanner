import { chromium } from 'playwright';

const testReportPath = '/home/runner/work/o-hat-scanner/o-hat-scanner/site/runs/test-run/index.html';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Log console messages
  page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
  
  // Log page errors
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  
  console.log('Loading page:', `file://${testReportPath}`);
  await page.goto(`file://${testReportPath}`);
  console.log('Page loaded');
  await page.waitForTimeout(1000);
  console.log('Waited 1 second');
  
  // Check if data-theme is set
  const hasAttr = await page.evaluate(() => document.documentElement.hasAttribute('data-theme'));
  console.log('Has data-theme attribute:', hasAttr);
  
  if (hasAttr) {
    const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    console.log('Theme value:', theme);
  } else {
    console.log('data-theme attribute NOT set!');
  }
  
  await browser.close();
})();
