import fs from 'fs';
import path from 'path';
import { loadTargetsFile, sitesDueNow, buildRunId, sanitizeLabel } from '../scripts/targets.js';

const SAMPLE_YAML = `
sites:
  - name: va.gov
    baseUrl: https://www.va.gov
    mode: sitemap
    maxPages: 50
    schedule:
      - "0 6 * * TUE"
    label: VA Weekly!

  - name: cms.gov
    baseUrl: https://www.cms.gov
    mode: sitemap
    schedule:
      - "0 7 * * WED"

  - name: civicactions-list
    mode: list
    urls:
      - https://www.civicactions.com/
      - https://www.civicactions.com/blog
    schedule:
      - "0 5 * * MON"
    maxPages: 10
`;

describe('targets.yml resolver', () => {
  const tmpPath = path.join(process.cwd(), 'targets.test.tmp.yml');

  afterEach(() => {
    fs.rmSync(tmpPath, { force: true });
  });

  test('loads targets and applies defaults/sanitization', () => {
    fs.writeFileSync(tmpPath, SAMPLE_YAML, 'utf-8');
    const sites = loadTargetsFile(tmpPath);

    expect(sites).toHaveLength(3);
    expect(sites[0].maxPages).toBe(50);
    expect(sites[0].label).toBe('va-weekly');
    expect(sites[0].mode).toBe('sitemap');
    expect(sites[1].maxPages).toBe(50); // default applied
    expect(sites[2].mode).toBe('list');
    expect(sites[2].urls).toHaveLength(2);
  });

  test('filters due sites based on cron schedule', () => {
    fs.writeFileSync(tmpPath, SAMPLE_YAML, 'utf-8');
    const sites = loadTargetsFile(tmpPath);

    const tueNow = new Date('2024-01-02T06:00:00Z');
    const wedNow = new Date('2024-01-03T07:00:00Z');

    const dueTue = sitesDueNow(sites, tueNow).map(s => s.name);
    expect(dueTue).toContain('va.gov');
    expect(dueTue).not.toContain('cms.gov');

    const dueWed = sitesDueNow(sites, wedNow).map(s => s.name);
    expect(dueWed).toContain('cms.gov');
    expect(dueWed).not.toContain('va.gov');
  });

  test('buildRunId includes sanitized label', () => {
    const id = buildRunId('VA Weekly!');
    expect(id).toMatch(/--va-weekly$/);
    expect(sanitizeLabel('Health*Check 2024')).toBe('health-check-2024');
  });
});
