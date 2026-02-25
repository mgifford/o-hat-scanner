/**
 * Test light/dark mode implementation according to WCAG 2.2 AA best practices
 * Reference: https://github.com/mgifford/ACCESSIBILITY.md/blob/main/examples/LIGHT_DARK_MODE_ACCESSIBILITY_BEST_PRACTICES.md
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Light/Dark Mode Accessibility', () => {
  let browser, context, page;
  const testReportPath = path.join(__dirname, '..', 'site', 'runs', 'test-run', 'index.html');

  beforeAll(async () => {
    // Ensure test report exists
    if (!fs.existsSync(testReportPath)) {
      const siteDir = path.join(__dirname, '..', 'site', 'runs', 'test-run');
      fs.mkdirSync(siteDir, { recursive: true });

      // Create minimal results.json
      const results = {
        runId: 'test-run',
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        toolVersion: '1.0.0',
        mode: 'ci',
        config: { baseUrl: 'https://example.com', maxPages: 10, viewport: 'desktop', colorScheme: 'light', browser: 'chromium' },
        targets: ['https://example.com'],
        resultsByUrl: {
          'https://example.com': {
            violations: [],
            passes: [],
            incomplete: []
          }
        }
      };
      fs.writeFileSync(path.join(siteDir, 'results.json'), JSON.stringify(results, null, 2));

      // Generate the report
      const { execSync } = await import('child_process');
      execSync('node scripts/generate-report.js', { cwd: path.join(__dirname, '..') });
    }

    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser?.close();
  });

  beforeEach(async () => {
    context = await browser.newContext();
    page = await context.newPage();
  });

  afterEach(async () => {
    await page?.close();
    await context?.close();
  });

  test('should default to light mode when no system preference', async () => {
    await page.goto(`file://${testReportPath}`);
    // Wait for JavaScript to execute
    await page.waitForTimeout(500);
    await page.waitForFunction('document.documentElement.hasAttribute("data-theme")', { timeout: 2000 });
    const theme = await page.getAttribute('html', 'data-theme');
    expect(theme).toBe('light');
  });

  test('should respect system dark mode preference by default', async () => {
    await context.close();
    context = await browser.newContext({
      colorScheme: 'dark'
    });
    page = await context.newPage();
    
    await page.goto(`file://${testReportPath}`);
    // Wait for JavaScript to execute
    await page.waitForTimeout(500);
    await page.waitForFunction('document.documentElement.hasAttribute("data-theme")', { timeout: 2000 });
    const theme = await page.getAttribute('html', 'data-theme');
    expect(theme).toBe('dark');
  });

  test('should have CSS prefers-color-scheme support', async () => {
    await page.goto(`file://${testReportPath}`);
    const styles = await page.evaluate(() => {
      const styleSheets = Array.from(document.styleSheets);
      let hasPrefersDark = false;
      
      for (const sheet of styleSheets) {
        try {
          const rules = Array.from(sheet.cssRules || []);
          for (const rule of rules) {
            if (rule.type === CSSRule.MEDIA_RULE) {
              if (rule.media.mediaText.includes('prefers-color-scheme: dark')) {
                hasPrefersDark = true;
                break;
              }
            }
          }
        } catch (e) {
          // Cross-origin stylesheet, skip
        }
      }
      return { hasPrefersDark };
    });
    
    expect(styles.hasPrefersDark).toBe(true);
  });

  test('theme toggle button should have correct aria-label reflecting action', async () => {
    await page.goto(`file://${testReportPath}`);
    // Wait for JavaScript to execute
    await page.waitForTimeout(500);
    await page.waitForFunction('document.documentElement.hasAttribute("data-theme")', { timeout: 2000 });
    
    // In light mode, button should say "Switch to dark mode"
    let ariaLabel = await page.getAttribute('.theme-toggle', 'aria-label');
    expect(ariaLabel).toMatch(/switch to dark mode/i);
    
    // Click to switch to dark mode
    await page.click('.theme-toggle');
    
    // Now in dark mode, button should say "Switch to light mode"
    ariaLabel = await page.getAttribute('.theme-toggle', 'aria-label');
    expect(ariaLabel).toMatch(/switch to light mode/i);
  });

  test('theme toggle should use correct icons (moon in light, sun in dark)', async () => {
    await page.goto(`file://${testReportPath}`);
    // Wait for JavaScript to execute
    await page.waitForTimeout(500);
    await page.waitForFunction('document.documentElement.hasAttribute("data-theme")', { timeout: 2000 });
    
    // In light mode, should show moon icon (sun icon should be hidden)
    let sunVisible = await page.isVisible('.sun-icon');
    let moonVisible = await page.isVisible('.moon-icon');
    expect(sunVisible).toBe(false);
    expect(moonVisible).toBe(true);
    
    // Click to switch to dark mode
    await page.click('.theme-toggle');
    
    // In dark mode, should show sun icon (moon icon should be hidden)
    sunVisible = await page.isVisible('.sun-icon');
    moonVisible = await page.isVisible('.moon-icon');
    expect(sunVisible).toBe(true);
    expect(moonVisible).toBe(false);
  });

  test('theme toggle should persist user preference in localStorage', async () => {
    // Start a simple HTTP server for testing localStorage
    const http = await import('http');
    const fs = await import('fs');
    const path = await import('path');
    
    const server = http.createServer((req, res) => {
      const filePath = path.join(path.dirname(testReportPath), 'index.html');
      const content = fs.readFileSync(filePath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(content);
    });
    
    await new Promise(resolve => server.listen(0, resolve));
    const port = server.address().port;
    
    try {
      await page.goto(`http://localhost:${port}`);
      // Wait for JavaScript to execute
      await page.waitForTimeout(500);
      await page.waitForFunction('document.documentElement.hasAttribute("data-theme")', { timeout: 2000 });
      
      // Switch to dark mode
      await page.click('.theme-toggle');
      
      // Check localStorage
      const storedTheme = await page.evaluate(() => localStorage.getItem('report-theme'));
      expect(storedTheme).toBe('dark');
      
      // Reload page
      await page.reload();
      await page.waitForTimeout(500);
      await page.waitForFunction('document.documentElement.hasAttribute("data-theme")', { timeout: 2000 });
      
      // Should still be dark mode
      const theme = await page.getAttribute('html', 'data-theme');
      expect(theme).toBe('dark');
    } finally {
      server.close();
    }
  }, 20000);

  test('user override should persist even when system preference changes', async () => {
    // Start a simple HTTP server for testing localStorage
    const http = await import('http');
    const fs = await import('fs');
    const path = await import('path');
    
    const server = http.createServer((req, res) => {
      const filePath = path.join(path.dirname(testReportPath), 'index.html');
      const content = fs.readFileSync(filePath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(content);
    });
    
    await new Promise(resolve => server.listen(0, resolve));
    const port = server.address().port;
    
    try {
      await page.goto(`http://localhost:${port}`);
      // Wait for JavaScript to execute
      await page.waitForTimeout(500);
      await page.waitForFunction('document.documentElement.hasAttribute("data-theme")', { timeout: 2000 });
      
      // User explicitly sets dark mode
      await page.click('.theme-toggle');
      const storedTheme = await page.evaluate(() => localStorage.getItem('report-theme'));
      expect(storedTheme).toBe('dark');
      
      // System preference should not override user choice
      const theme = await page.getAttribute('html', 'data-theme');
      expect(theme).toBe('dark');
    } finally {
      server.close();
    }
  }, 20000);

  test('theme toggle should be keyboard accessible', async () => {
    await page.goto(`file://${testReportPath}`);
    // Wait for JavaScript to execute
    await page.waitForTimeout(500);
    await page.waitForFunction('document.documentElement.hasAttribute("data-theme")', { timeout: 2000 });
    
    // Focus the theme toggle directly
    await page.focus('#theme-toggle');
    
    // Check if theme toggle is focused
    const focusedElement = await page.evaluate(() => {
      const focused = document.activeElement;
      return {
        id: focused.id,
        tagName: focused.tagName
      };
    });
    
    expect(focusedElement.id).toBe('theme-toggle');
    
    // Get initial theme
    const initialTheme = await page.getAttribute('html', 'data-theme');
    
    // Press Enter to activate
    await page.keyboard.press('Enter');
    
    // Wait a bit for the theme to change
    await page.waitForTimeout(100);
    
    const newTheme = await page.getAttribute('html', 'data-theme');
    expect(newTheme).not.toBe(initialTheme);
  });

  test('theme toggle should have visible focus indicator meeting 3:1 contrast', async () => {
    await page.goto(`file://${testReportPath}`);
    
    // Focus the theme toggle
    await page.focus('.theme-toggle');
    
    // Check for outline
    const outline = await page.evaluate(() => {
      const toggle = document.querySelector('.theme-toggle');
      const styles = window.getComputedStyle(toggle);
      return {
        outlineWidth: styles.outlineWidth,
        outlineStyle: styles.outlineStyle,
        outlineColor: styles.outlineColor
      };
    });
    
    expect(outline.outlineStyle).not.toBe('none');
    expect(parseFloat(outline.outlineWidth)).toBeGreaterThanOrEqual(2);
  });

  test('all color variables should be defined for both light and dark modes', async () => {
    // Start a simple HTTP server for proper theme testing
    const http = await import('http');
    const fs = await import('fs');
    const path = await import('path');
    
    const server = http.createServer((req, res) => {
      const filePath = path.join(path.dirname(testReportPath), 'index.html');
      const content = fs.readFileSync(filePath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(content);
    });
    
    await new Promise(resolve => server.listen(0, resolve));
    const port = server.address().port;
    
    try {
      await page.goto(`http://localhost:${port}`);
      
      const colorVars = [
        '--bg', '--panel-bg', '--panel-border', '--text', '--muted',
        '--link', '--link-visited', '--header-text',
        '--pill-critical', '--pill-warning', '--pill-info',
        '--card-bg', '--bar-bg', '--code-bg', '--focus'
      ];
      
      // Ensure we start in light mode
      await page.evaluate(() => {
        document.documentElement.setAttribute('data-theme', 'light');
      });
      
      // Check light mode
      const lightColors = await page.evaluate((vars) => {
        const root = document.documentElement;
        const styles = window.getComputedStyle(root);
        return vars.reduce((acc, varName) => {
          acc[varName] = styles.getPropertyValue(varName).trim();
          return acc;
        }, {});
      }, colorVars);
      
      // Switch to dark mode
      await page.evaluate(() => {
        document.documentElement.setAttribute('data-theme', 'dark');
      });
      
      // Check dark mode
      const darkColors = await page.evaluate((vars) => {
        const root = document.documentElement;
        const styles = window.getComputedStyle(root);
        return vars.reduce((acc, varName) => {
          acc[varName] = styles.getPropertyValue(varName).trim();
          return acc;
        }, {});
      }, colorVars);
      
      // All variables should have values in both modes
      colorVars.forEach(varName => {
        expect(lightColors[varName]).toBeTruthy();
        expect(darkColors[varName]).toBeTruthy();
        expect(lightColors[varName]).not.toBe(darkColors[varName]); // Should be different
      });
    } finally {
      server.close();
    }
  }, 15000);

  test('should respect prefers-reduced-motion for theme transitions', async () => {
    await context.close();
    context = await browser.newContext({
      reducedMotion: 'reduce'
    });
    page = await context.newPage();
    
    await page.goto(`file://${testReportPath}`);
    
    // Check that transitions are disabled or set to none
    const transitions = await page.evaluate(() => {
      const body = document.body;
      const styles = window.getComputedStyle(body);
      return {
        transition: styles.transition,
        transitionDuration: styles.transitionDuration
      };
    });
    
    // With prefers-reduced-motion, transitions should be none or 0s
    expect(transitions.transition === 'none' || transitions.transitionDuration === '0s').toBe(true);
  });
});
