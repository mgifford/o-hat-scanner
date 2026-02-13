import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();

// Load the generated page
await page.goto('file://' + process.cwd() + '/site/runs/example-com/test-error-color/index.html');

// Get computed colors for the strong element in the error section
const info = await page.evaluate(() => {
  // Find all strong elements
  const strongs = Array.from(document.querySelectorAll('strong'));
  
  // Find the one that says "http://example.com/page1"
  const errorStrong = strongs.find(s => s.textContent.includes('http://example.com/page1'));
  
  if (!errorStrong) {
    return { 
      error: 'error strong not found',
      allStrongs: strongs.map(s => s.textContent)
    };
  }
  
  const computed = window.getComputedStyle(errorStrong);
  const panel = errorStrong.closest('.panel') || errorStrong.closest('div[style*="background-color"]');
  const panelComputed = panel ? window.getComputedStyle(panel) : null;
  
  return {
    strong: {
      color: computed.color,
      backgroundColor: computed.backgroundColor,
      fontSize: computed.fontSize,
      fontWeight: computed.fontWeight,
      text: errorStrong.textContent
    },
    panel: panelComputed ? {
      backgroundColor: panelComputed.backgroundColor,
      className: panel.className,
      hasInlineStyle: panel.hasAttribute('style')
    } : 'no panel found'
  };
});

console.log('Info:', JSON.stringify(info, null, 2));

await browser.close();
