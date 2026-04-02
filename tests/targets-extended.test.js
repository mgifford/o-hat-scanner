import fs from 'fs';
import path from 'path';
import { loadTargetsFile, sitesDueNow } from '../scripts/targets.js';

const VALID_YAML = `
sites:
  - name: site-a
    baseUrl: https://site-a.com
    mode: sitemap
    maxPages: 30
    schedule:
      - "0 6 * * MON"
    label: Site A

  - name: site-b
    baseUrl: https://site-b.com
    mode: crawl
    schedule:
      - "0 8 * * WED"

  - name: site-list
    mode: list
    urls:
      - https://example.com/
      - https://example.com/about
    schedule:
      - "0 5 * * FRI"
    maxPages: 5

  - name: site-no-schedule
    baseUrl: https://always.com
    mode: sitemap
`;

describe('loadTargetsFile', () => {
  const tmpPath = path.join(process.cwd(), 'targets-edge.tmp.yml');

  afterEach(() => {
    fs.rmSync(tmpPath, { force: true });
  });

  test('loads and normalizes a valid YAML file', () => {
    fs.writeFileSync(tmpPath, VALID_YAML, 'utf-8');
    const sites = loadTargetsFile(tmpPath);
    expect(sites).toHaveLength(4);
  });

  test('applies default maxPages when not specified', () => {
    fs.writeFileSync(tmpPath, VALID_YAML, 'utf-8');
    const sites = loadTargetsFile(tmpPath);
    const siteB = sites.find(s => s.name === 'site-b');
    expect(siteB.maxPages).toBe(50); // default
  });

  test('preserves explicit maxPages', () => {
    fs.writeFileSync(tmpPath, VALID_YAML, 'utf-8');
    const sites = loadTargetsFile(tmpPath);
    const siteA = sites.find(s => s.name === 'site-a');
    expect(siteA.maxPages).toBe(30);
  });

  test('sanitizes label', () => {
    fs.writeFileSync(tmpPath, VALID_YAML, 'utf-8');
    const sites = loadTargetsFile(tmpPath);
    const siteA = sites.find(s => s.name === 'site-a');
    expect(siteA.label).toBe('site-a'); // "Site A" sanitized
  });

  test('uses name as label when label not provided', () => {
    fs.writeFileSync(tmpPath, VALID_YAML, 'utf-8');
    const sites = loadTargetsFile(tmpPath);
    const siteB = sites.find(s => s.name === 'site-b');
    expect(siteB.label).toBe('site-b');
  });

  test('includes urls array for list mode', () => {
    fs.writeFileSync(tmpPath, VALID_YAML, 'utf-8');
    const sites = loadTargetsFile(tmpPath);
    const siteList = sites.find(s => s.name === 'site-list');
    expect(siteList.urls).toHaveLength(2);
  });

  test('defaults schedule to empty array when not specified', () => {
    fs.writeFileSync(tmpPath, VALID_YAML, 'utf-8');
    const sites = loadTargetsFile(tmpPath);
    const noSched = sites.find(s => s.name === 'site-no-schedule');
    expect(noSched.schedule).toEqual([]);
  });

  test('throws when file does not exist', () => {
    expect(() => loadTargetsFile('/nonexistent/path/targets.yml')).toThrow(/not found/);
  });

  test('throws when YAML has no sites array', () => {
    fs.writeFileSync(tmpPath, 'noSitesKey:\n  - foo\n', 'utf-8');
    expect(() => loadTargetsFile(tmpPath)).toThrow(/must contain a top-level "sites" array/);
  });

  test('throws when a site entry has no name', () => {
    const yaml = `
sites:
  - baseUrl: https://no-name.com
    mode: sitemap
`;
    fs.writeFileSync(tmpPath, yaml, 'utf-8');
    expect(() => loadTargetsFile(tmpPath)).toThrow(/must have a name/);
  });

  test('throws on invalid mode', () => {
    const yaml = `
sites:
  - name: bad-site
    baseUrl: https://bad.com
    mode: unknown-mode
`;
    fs.writeFileSync(tmpPath, yaml, 'utf-8');
    expect(() => loadTargetsFile(tmpPath)).toThrow(/Invalid mode/);
  });

  test('accepts discover mode', () => {
    const yaml = `
sites:
  - name: discover-site
    baseUrl: https://discover.com
    mode: discover
`;
    fs.writeFileSync(tmpPath, yaml, 'utf-8');
    const sites = loadTargetsFile(tmpPath);
    expect(sites[0].mode).toBe('discover');
  });

  test('includes discoveryQueries when provided', () => {
    const yaml = `
sites:
  - name: discover-site
    baseUrl: https://discover.com
    mode: discover
    discoveryQueries:
      - "accessibility site:discover.com"
      - "services site:discover.com"
`;
    fs.writeFileSync(tmpPath, yaml, 'utf-8');
    const sites = loadTargetsFile(tmpPath);
    expect(sites[0].discoveryQueries).toHaveLength(2);
  });

  test('defaults discoveryQueries to empty array when not specified', () => {
    fs.writeFileSync(tmpPath, VALID_YAML, 'utf-8');
    const sites = loadTargetsFile(tmpPath);
    expect(sites[0].discoveryQueries).toEqual([]);
  });

  test('preserves notes field', () => {
    const yaml = `
sites:
  - name: noted-site
    baseUrl: https://noted.com
    mode: sitemap
    notes: "This is a note"
`;
    fs.writeFileSync(tmpPath, yaml, 'utf-8');
    const sites = loadTargetsFile(tmpPath);
    expect(sites[0].notes).toBe('This is a note');
  });
});

describe('sitesDueNow', () => {
  const tmpPath = path.join(process.cwd(), 'targets-due.tmp.yml');

  afterEach(() => {
    fs.rmSync(tmpPath, { force: true });
  });

  test('site with no schedule is always due', () => {
    fs.writeFileSync(tmpPath, VALID_YAML, 'utf-8');
    const sites = loadTargetsFile(tmpPath);
    const noSchedSite = sites.find(s => s.name === 'site-no-schedule');
    // Use any date
    const due = sitesDueNow([noSchedSite], new Date('2024-03-15T12:00:00Z'));
    expect(due).toHaveLength(1);
  });

  test('site with non-matching schedule is not due', () => {
    fs.writeFileSync(tmpPath, VALID_YAML, 'utf-8');
    const sites = loadTargetsFile(tmpPath);
    const siteA = sites.find(s => s.name === 'site-a'); // runs MON at 06:00
    // Use a Thursday date
    const due = sitesDueNow([siteA], new Date('2024-01-04T06:00:00Z')); // Thursday
    expect(due).toHaveLength(0);
  });

  test('site is due on matching cron day and hour', () => {
    fs.writeFileSync(tmpPath, VALID_YAML, 'utf-8');
    const sites = loadTargetsFile(tmpPath);
    const siteA = sites.find(s => s.name === 'site-a'); // 0 6 * * MON
    // 2024-01-01 is a Monday at UTC 06:00
    const due = sitesDueNow([siteA], new Date('2024-01-01T06:00:00Z'));
    expect(due).toHaveLength(1);
  });

  test('handles invalid cron expression gracefully', () => {
    const site = {
      name: 'bad-cron',
      baseUrl: 'https://bad.com',
      mode: 'sitemap',
      schedule: ['not-a-cron'],
      maxPages: 50,
      label: 'bad-cron'
    };
    // Should not throw; just return empty (invalid cron does not match)
    expect(() => sitesDueNow([site], new Date())).not.toThrow();
  });
});
