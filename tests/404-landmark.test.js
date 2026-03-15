import fs from 'fs';
import path from 'path';

describe('404 page landmark accessibility', () => {
  const __dirname = path.dirname(new URL(import.meta.url).pathname);
  const ROOT = path.resolve(__dirname, '..');
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

  test('generate-report copies 404.html to site/ so it is deployed to GitHub Pages', async () => {
    // Import the report generator and trigger it
    const { generateMainIndex } = await import('../scripts/generate-report.js');

    // Ensure site/ exists (report generator creates it)
    const siteDir = path.join(ROOT, 'site');
    fs.mkdirSync(siteDir, { recursive: true });

    // generateMainIndex does not copy statics; verify that running the full
    // generate-report script (node scripts/generate-report.js) produces site/404.html.
    // We test the copyStaticFiles side-effect by calling the script directly.
    const { execFileSync } = await import('child_process');
    execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'generate-report.js')], { cwd: ROOT });

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
