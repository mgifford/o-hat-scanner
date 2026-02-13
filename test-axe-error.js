import { chromium } from 'playwright';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const axe = require('axe-core');

const browser = await chromium.launch();
const page = await browser.newPage();

// Load the generated page
await page.goto('file://' + process.cwd() + '/site/runs/example-com/test-error-color/index.html');

// Inject axe-core
await page.addScriptTag({ content: axe.source });

// Run axe
const results = await page.evaluate(async () => {
  const results = await window.axe.run();
  return results.violations;
});

// Filter for color-contrast violations
const contrastViolations = results.filter(v => v.id === 'color-contrast');

console.log('Color contrast violations:', JSON.stringify(contrastViolations, null, 2));

await browser.close();
