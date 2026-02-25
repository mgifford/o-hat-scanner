import { chromium } from 'playwright';

const testReportPath = '/home/runner/work/o-hat-scanner/o-hat-scanner/site/runs/test-run/index.html';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('pageerror', err => {
    // Try to parse the error for line number
    console.log('Full error:', JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
  });
  
  try {
    await page.goto(`file://${testReportPath}`);
  } catch (e) {
    console.log('Navigation error:', e.message);
  }
  
  await page.waitForTimeout(500);
  
  // Try to manually parse and execute the script to find the error
  const scriptContent = await page.evaluate(() => {
    const scripts = Array.from(document.getElementsByTagName('script'));
    return scripts.map(s => s.innerHTML);
  });
  
  console.log('Number of script tags:', scriptContent.length);
  
  await browser.close();
})();
