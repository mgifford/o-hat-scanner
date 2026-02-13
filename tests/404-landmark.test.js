import fs from 'fs';
import path from 'path';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(__dirname, '..');

describe('404 page landmark compliance', () => {
  const siteDir = path.join(ROOT, 'site');
  const notFoundPath = path.join(siteDir, '404.html');
  let generate404Page;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    const mod = await import('../scripts/generate-report.js');
    generate404Page = mod.generate404Page;
  });

  beforeEach(() => {
    fs.rmSync(siteDir, { recursive: true, force: true });
    fs.mkdirSync(siteDir, { recursive: true });
  });

  afterAll(() => {
    fs.rmSync(siteDir, { recursive: true, force: true });
  });

  test('creates 404.html file in site directory', () => {
    generate404Page();
    expect(fs.existsSync(notFoundPath)).toBe(true);
  });

  test('404 page has proper landmark structure with main element', () => {
    generate404Page();
    const html = fs.readFileSync(notFoundPath, 'utf-8');
    
    // Must have main landmark to avoid "region" axe violation
    expect(html).toContain('<main');
    // Should have id="main" for skip link target
    expect(html).toContain('id="main"');
  });

  test('404 page has lang attribute for WCAG 2.1 AA (html-has-lang)', () => {
    generate404Page();
    const html = fs.readFileSync(notFoundPath, 'utf-8');
    
    expect(html).toMatch(/<html[^>]+lang="en"/);
  });

  test('404 page content (h1) is inside main landmark', () => {
    generate404Page();
    const html = fs.readFileSync(notFoundPath, 'utf-8');
    
    // Extract content between <main> and </main>
    const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/);
    expect(mainMatch).not.toBeNull();
    
    const mainContent = mainMatch[1];
    // The h1 should be inside main
    expect(mainContent).toContain('<h1');
    expect(mainContent).toContain('404');
  });

  test('404 page has skip link for keyboard navigation', () => {
    generate404Page();
    const html = fs.readFileSync(notFoundPath, 'utf-8');
    
    // Skip link should exist for keyboard users
    expect(html).toContain('Skip to main content');
    expect(html).toContain('href="#main"');
  });

  test('404 page has proper document structure', () => {
    generate404Page();
    const html = fs.readFileSync(notFoundPath, 'utf-8');
    
    // Proper DOCTYPE
    expect(html).toMatch(/<!DOCTYPE html>/i);
    
    // Meta charset
    expect(html).toContain('charset="UTF-8"');
    
    // Viewport meta
    expect(html).toContain('viewport');
    
    // Title element
    expect(html).toContain('<title>');
    expect(html).toMatch(/<title>.*404.*<\/title>/i);
  });

  test('404 page links have text-decoration underline for WCAG 2.1 SC 1.4.1', () => {
    generate404Page();
    const html = fs.readFileSync(notFoundPath, 'utf-8');
    
    // Check for link underline in styles
    expect(html).toMatch(/a\s*{[^}]*text-decoration:\s*underline/);
  });

  test('404 page provides helpful navigation back to home', () => {
    generate404Page();
    const html = fs.readFileSync(notFoundPath, 'utf-8');
    
    // Should have link back to index
    expect(html).toContain('index.html');
  });
});
