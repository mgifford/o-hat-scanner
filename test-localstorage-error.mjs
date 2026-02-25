import { chromium } from 'playwright';
import fs from 'fs';

const testReportPath = '/home/runner/work/o-hat-scanner/o-hat-scanner/site/runs/test-run/index.html';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Get the error location
  page.on('pageerror', async (err) => {
    console.log('=== PAGE ERROR ===');
    console.log('Message:', err.message);
    console.log('Stack:', err.stack);
    
    // Try to get more details
    const errorDetails = await page.evaluate(() => {
      try {
        // Try to access localStorage
        const test = localStorage.getItem('test');
        return { localStorageWorks: true };
      } catch (e) {
        return { localStorageWorks: false, error: e.message };
      }
    });
    console.log('localStorage test:', errorDetails);
  });
  
  await page.goto(`file://${testReportPath}`);
  await page.waitForTimeout(1000);
  
  await browser.close();
})();
