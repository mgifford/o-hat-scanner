import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();

// Load the generated page
await page.goto('file://' + process.cwd() + '/site/runs/example-com/test-error-color/index.html');

// Get the error text "File not found"
const info = await page.evaluate(() => {
  // Find all text nodes containing "File not found"
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null
  );
  
  let node;
  let foundElement = null;
  
  while (node = walker.nextNode()) {
    if (node.textContent.includes('File not found')) {
      foundElement = node.parentElement;
      break;
    }
  }
  
  if (!foundElement) return { error: 'text not found' };
  
  const computed = window.getComputedStyle(foundElement);
  const panel = foundElement.closest('.panel') || foundElement.closest('div[style*="background-color"]');
  const panelComputed = panel ? window.getComputedStyle(panel) : null;
  
  return {
    element: {
      tagName: foundElement.tagName,
      color: computed.color,
      backgroundColor: computed.backgroundColor,
      fontSize: computed.fontSize,
      fontWeight: computed.fontWeight,
      text: foundElement.textContent,
      innerHTML: foundElement.innerHTML
    },
    panel: panelComputed ? {
      backgroundColor: panelComputed.backgroundColor
    } : 'no panel'
  };
});

console.log('Info:', JSON.stringify(info, null, 2));

await browser.close();
