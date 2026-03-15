import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

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
});
