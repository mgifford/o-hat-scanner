import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();

// Load the generated page
await page.goto('file://' + process.cwd() + '/site/runs/example-com/test-error-color/index.html');

// Get computed colors for the strong element in the error section
const colors = await page.evaluate(() => {
  // Find the strong element in the error list
  const errorList = document.querySelector('ul');
  const strongEl = errorList?.querySelector('strong');
  
  if (!strongEl) return { error: 'strong element not found' };
  
  const computed = window.getComputedStyle(strongEl);
  const parent = strongEl.parentElement;
  const parentComputed = window.getComputedStyle(parent);
  const panel = strongEl.closest('.panel');
  const panelComputed = panel ? window.getComputedStyle(panel) : null;
  
  return {
    strong: {
      color: computed.color,
      backgroundColor: computed.backgroundColor,
      fontSize: computed.fontSize,
      fontWeight: computed.fontWeight
    },
    parent: {
      color: parentComputed.color,
      backgroundColor: parentComputed.backgroundColor
    },
    panel: panelComputed ? {
      backgroundColor: panelComputed.backgroundColor
    } : null,
    innerHTML: strongEl.innerHTML
  };
});

console.log('Computed colors:', JSON.stringify(colors, null, 2));

await browser.close();
