import fs from 'fs';
import path from 'path';
import { resolveTargets } from '../scripts/resolve-targets.js';

const MULTI_YAML = `
sites:
  - name: alpha
    baseUrl: https://alpha.com
    mode: sitemap
    maxPages: 10
    schedule:
      - "0 1 * * MON"
    label: alpha-label

  - name: beta
    baseUrl: https://beta.com
    mode: crawl
    maxPages: 20
    schedule:
      - "0 2 * * TUE"
    label: beta-label

  - name: no-schedule-site
    baseUrl: https://always.com
    mode: sitemap
`;

describe('resolveTargets – extended', () => {
  const tmpPath = path.join(process.cwd(), 'targets-resolve-ext.tmp.yml');

  beforeEach(() => {
    fs.writeFileSync(tmpPath, MULTI_YAML, 'utf-8');
  });

  afterEach(() => {
    fs.rmSync(tmpPath, { force: true });
  });

  test('returns all sites when respectSchedule is false', () => {
    const sites = resolveTargets({ file: tmpPath, now: new Date('2024-01-01'), respectSchedule: false });
    expect(sites).toHaveLength(3);
  });

  test('includes only due sites when respectSchedule is true', () => {
    // 2024-01-01 is Monday UTC 01:00 → alpha is due; no-schedule-site is always due
    const sites = resolveTargets({ file: tmpPath, now: new Date('2024-01-01T01:00:00Z'), respectSchedule: true });
    const names = sites.map(s => s.name);
    expect(names).toContain('alpha');
    expect(names).toContain('no-schedule-site');
    expect(names).not.toContain('beta');
  });

  test('filters by name', () => {
    const sites = resolveTargets({ file: tmpPath, filter: 'alpha', respectSchedule: false });
    expect(sites).toHaveLength(1);
    expect(sites[0].name).toBe('alpha');
  });

  test('filters by label', () => {
    const sites = resolveTargets({ file: tmpPath, filter: 'beta-label', respectSchedule: false });
    expect(sites).toHaveLength(1);
    expect(sites[0].name).toBe('beta');
  });

  test('returns empty array when filter matches nothing and allowAdhoc is false', () => {
    const sites = resolveTargets({ file: tmpPath, filter: 'nonexistent', allowAdhoc: false, respectSchedule: false });
    expect(sites).toHaveLength(0);
  });

  test('creates adhoc target when filter misses and allowAdhoc is true', () => {
    const sites = resolveTargets({ file: tmpPath, filter: 'new-site.gov', allowAdhoc: true, respectSchedule: false });
    expect(sites).toHaveLength(1);
    expect(sites[0].name).toBe('new-site.gov');
    expect(sites[0].baseUrl).toBe('https://new-site.gov');
    expect(sites[0].mode).toBe('sitemap');
  });

  test('adhoc target preserves full https URL as baseUrl', () => {
    const sites = resolveTargets({
      file: tmpPath,
      filter: 'https://full.url.com',
      allowAdhoc: true,
      respectSchedule: false
    });
    expect(sites[0].baseUrl).toBe('https://full.url.com');
  });

  test('adhoc target preserves full http URL as baseUrl', () => {
    const sites = resolveTargets({
      file: tmpPath,
      filter: 'http://insecure.example.com',
      allowAdhoc: true,
      respectSchedule: false
    });
    expect(sites[0].baseUrl).toBe('http://insecure.example.com');
  });

  test('writes output file when output path is provided via resolveTargets (via main – indirect)', () => {
    // The resolveTargets function itself doesn't write a file; main() does.
    // Ensure the function returns stable data for writing downstream.
    const sites = resolveTargets({ file: tmpPath, respectSchedule: false });
    const serialized = JSON.stringify(sites, null, 2);
    expect(() => JSON.parse(serialized)).not.toThrow();
    expect(JSON.parse(serialized)).toHaveLength(3);
  });

  test('respects schedule + filter combination', () => {
    // alpha is due Monday at 01:00; filter for alpha on that day
    const sites = resolveTargets({
      file: tmpPath,
      filter: 'alpha',
      now: new Date('2024-01-01T01:00:00Z'),
      respectSchedule: true
    });
    expect(sites).toHaveLength(1);
    expect(sites[0].name).toBe('alpha');
  });

  test('returns empty when schedule+filter finds nothing', () => {
    // alpha is NOT due on Tuesday; filter for alpha on Tuesday
    const sites = resolveTargets({
      file: tmpPath,
      filter: 'alpha',
      now: new Date('2024-01-02T01:00:00Z'), // Tuesday
      respectSchedule: true
    });
    expect(sites).toHaveLength(0);
  });
});
