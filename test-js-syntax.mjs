import { chromium } from 'playwright';

const testReportPath = '/home/runner/work/o-hat-scanner/o-hat-scanner/site/runs/test-run/index.html';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Store all console and error messages
  const messages = [];
  page.on('console', msg => messages.push({ type: msg.type(), text: msg.text() }));
  page.on('pageerror', err => messages.push({ type: 'error', text: err.message, stack: err.stack }));
  
  await page.goto(`file://${testReportPath}`);
  await page.waitForTimeout(500);
  
  // Print all messages
  console.log('Messages:', JSON.stringify(messages, null, 2));
  
  await browser.close();
})();
