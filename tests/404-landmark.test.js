import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Utility: calculate relative luminance per WCAG 2.x
function relativeLuminance(hexColor) {
  let hex = hexColor.replace('#', '');
  // Expand 3-digit shorthand (e.g. #333 -> #333333)
  if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  const linearize = (c) => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

function contrastRatio(color1, color2) {
  const l1 = relativeLuminance(color1);
  const l2 = relativeLuminance(color2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('404 page landmark accessibility', () => {
  const page404Path = path.join(ROOT, 'static', '404.html');

  test('404 page has main landmark wrapping all content', () => {
    expect(fs.existsSync(page404Path)).toBe(true);
    const html = fs.readFileSync(page404Path, 'utf-8');

    // Must have a <main> element
    expect(html).toContain('<main');

    // The h1 should be inside the main element
    // Check that main comes before h1 and closing main comes after h1
    const mainStart = html.indexOf('<main');
    const mainEnd = html.indexOf('</main>');
    const h1Index = html.indexOf('<h1>');

    expect(mainStart).toBeGreaterThan(-1);
    expect(mainEnd).toBeGreaterThan(-1);
    expect(h1Index).toBeGreaterThan(-1);

    // Ensure h1 is between main opening and closing tags
    expect(h1Index).toBeGreaterThan(mainStart);
    expect(h1Index).toBeLessThan(mainEnd);
  });

  test('404 page links have text-decoration underline to meet WCAG 2.1 SC 1.4.1 (link-in-text-block)', () => {
    const html = fs.readFileSync(page404Path, 'utf-8');

    // Extract the CSS style block
    const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
    expect(styleMatch).toBeTruthy();

    const css = styleMatch[1];

    // Links must have text-decoration: underline at the base level so they are
    // distinguishable from surrounding text without relying on color alone
    expect(css).toMatch(/\ba\s*\{[^}]*text-decoration:\s*underline[^}]*\}/);

    // Links must NOT rely solely on color (no text-decoration: none at base level)
    expect(css).not.toMatch(/\ba\s*\{[^}]*text-decoration:\s*none[^}]*\}/);
  });

  test('404 page meets axe region rule requirements', () => {
    const html = fs.readFileSync(page404Path, 'utf-8');

    // All page content should be inside landmarks (main, nav, aside, header, footer)
    // For the 404 page, we should have a <main> landmark
    expect(html).toMatch(/<main[^>]*>/);

    // Content elements should be inside the main landmark
    // Parse to ensure structure is correct
    const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/);
    expect(mainMatch).toBeTruthy();

    if (mainMatch) {
      const mainContent = mainMatch[1];
      // h1 and paragraphs should be inside main
      expect(mainContent).toContain('<h1>');
      expect(mainContent).toContain('<p>');
      expect(mainContent).toContain('<a');
    }
  });

  test('404 page does not use low-contrast color #797979 on #f1f1f1 (the reported axe violation)', () => {
    const html = fs.readFileSync(page404Path, 'utf-8');

    // The reported violation: #797979 foreground on #f1f1f1 background = 3.85:1 (fails WCAG AA 4.5:1)
    // Ensure neither the bad foreground color nor the bad background color appear in the file
    expect(html).not.toContain('#797979');
    expect(html).not.toContain('#f1f1f1');

    // Verify there is no <strong> element that could carry the reported violation
    // (the axe report flagged: <strong>File not found</strong> with those bad colors)
    // If a <strong> element is added in future, a contrast test below will catch it
    const strongElements = html.match(/<strong[^>]*>[\s\S]*?<\/strong>/gi) || [];
    for (const el of strongElements) {
      // No inline color style that would produce low contrast (#797979 = rgb(121, 121, 121))
      expect(el).not.toMatch(/color\s*:\s*#797979/i);
    }
  });

  test('404 page link color meets WCAG AA 4.5:1 contrast ratio on page background', () => {
    const html = fs.readFileSync(page404Path, 'utf-8');

    // Extract link color from CSS - only valid 3-digit or 6-digit hex colors
    const linkColorMatch = html.match(/a\s*{[^}]*color\s*:\s*(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})\b/);
    expect(linkColorMatch).toBeTruthy();
    const linkColor = linkColorMatch[1];

    // Extract body background color from CSS
    const bgColorMatch = html.match(/body\s*{[^}]*background-color\s*:\s*(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})\b/);
    expect(bgColorMatch).toBeTruthy();
    const bgColor = bgColorMatch[1];

    const ratio = contrastRatio(linkColor, bgColor);
    // WCAG AA requires 4.5:1 for normal text (the link text is 18px semi-bold, <14pt bold threshold)
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  test('404 page body text color meets WCAG AA 4.5:1 contrast ratio on page background', () => {
    const html = fs.readFileSync(page404Path, 'utf-8');

    // Two-step: extract body CSS block then find the text color (not background-color)
    const bodyBlockMatch = html.match(/body\s*{([^}]*)}/);
    expect(bodyBlockMatch).toBeTruthy();
    const bodyStyle = bodyBlockMatch[1];

    // Find color property (not background-color) by looking for "; color:" or start of block
    const textColorMatch = bodyStyle.match(/(?:^|;)\s*color\s*:\s*(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})\b/);
    expect(textColorMatch).toBeTruthy();
    const textColor = textColorMatch[1];

    // Extract body background color
    const bgColorMatch = bodyStyle.match(/background-color\s*:\s*(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})\b/);
    expect(bgColorMatch).toBeTruthy();
    const bgColor = bgColorMatch[1];

    const ratio = contrastRatio(textColor, bgColor);
    // WCAG AA requires 4.5:1 for normal text
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  test('generate-report copies 404.html to site/ so it is deployed to GitHub Pages', async () => {
    const { copyStaticFiles } = await import('../scripts/generate-report.js');

    // Ensure site/ exists (report generator creates it)
    const siteDir = path.join(ROOT, 'site');
    fs.mkdirSync(siteDir, { recursive: true });

    // Call copyStaticFiles directly to test the static file copy logic in isolation
    copyStaticFiles();

    const site404Path = path.join(siteDir, '404.html');
    expect(fs.existsSync(site404Path)).toBe(true);

    const html = fs.readFileSync(site404Path, 'utf-8');
    // Must contain a main landmark
    expect(html).toMatch(/<main[^>]*>/);
    // h1 must be inside main
    const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/);
    expect(mainMatch).toBeTruthy();
    if (mainMatch) {
      expect(mainMatch[1]).toContain('<h1>');
    }
  });
});

describe('generate404Page deploys main landmark to site/', () => {
  const siteDir = path.join(ROOT, 'site');
  const site404Path = path.join(siteDir, '404.html');
  let generate404Page;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    ({ generate404Page } = await import('../scripts/generate-report.js'));
    fs.mkdirSync(siteDir, { recursive: true });
    generate404Page();
  });

  afterAll(() => {
    try {
      fs.rmSync(site404Path, { force: true });
    } catch (err) {
      // Ignore cleanup errors
    }
  });

  test('generate404Page writes site/404.html', () => {
    expect(fs.existsSync(site404Path)).toBe(true);
  });

  test('site/404.html has a main landmark (landmark-one-main)', () => {
    const html = fs.readFileSync(site404Path, 'utf-8');
    expect(html).toMatch(/<main[^>]*>/);
  });

  test('site/404.html main landmark wraps h1 and content', () => {
    const html = fs.readFileSync(site404Path, 'utf-8');

    const mainStart = html.indexOf('<main');
    const mainEnd = html.indexOf('</main>');
    const h1Index = html.indexOf('<h1>');

    expect(mainStart).toBeGreaterThan(-1);
    expect(mainEnd).toBeGreaterThan(-1);
    expect(h1Index).toBeGreaterThan(-1);
    expect(h1Index).toBeGreaterThan(mainStart);
    expect(h1Index).toBeLessThan(mainEnd);
  });

  test('site/404.html has lang attribute on html element', () => {
    const html = fs.readFileSync(site404Path, 'utf-8');
    expect(html).toMatch(/<html[^>]*lang=/);
  });

  test('site/404.html link color meets WCAG AA 4.5:1 contrast ratio on page background', () => {
    const html = fs.readFileSync(site404Path, 'utf-8');

    // Extract link color from CSS
    const linkColorMatch = html.match(/a\s*{[^}]*color\s*:\s*(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})\b/);
    expect(linkColorMatch).toBeTruthy();
    const linkColor = linkColorMatch[1];

    // Extract body background color from CSS
    const bgColorMatch = html.match(/body\s*{[^}]*background-color\s*:\s*(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})\b/);
    expect(bgColorMatch).toBeTruthy();
    const bgColor = bgColorMatch[1];

    const ratio = contrastRatio(linkColor, bgColor);
    // WCAG AA requires 4.5:1 for normal text
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  test('site/404.html link has text-decoration underline at base level (WCAG SC 1.4.1)', () => {
    const html = fs.readFileSync(site404Path, 'utf-8');
    const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
    expect(styleMatch).toBeTruthy();
    const css = styleMatch[1];
    expect(css).toMatch(/\ba\s*\{[^}]*text-decoration:\s*underline[^}]*\}/);
    expect(css).not.toMatch(/\ba\s*\{[^}]*text-decoration:\s*none[^}]*\}/);
  });
});
