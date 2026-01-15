import fs from 'fs';
import path from 'path';
import { resolveTargets } from '../scripts/resolve-targets.js';

const SAMPLE_YAML = `
sites:
  - name: example.com
    baseUrl: https://example.com
    mode: sitemap
    maxPages: 10
    schedule:
      - "0 1 * * MON"
    label: example-weekly
`;

describe('resolve-targets adhoc fallback', () => {
  const tmpPath = path.join(process.cwd(), 'targets.resolve.tmp.yml');

  beforeEach(() => {
    fs.writeFileSync(tmpPath, SAMPLE_YAML, 'utf-8');
  });

  afterEach(() => {
    fs.rmSync(tmpPath, { force: true });
  });

  test('returns scheduled sites when matched', () => {
    const sites = resolveTargets({ file: tmpPath, now: new Date('2024-01-01T01:00:00Z'), respectSchedule: true });
    expect(sites).toHaveLength(1);
    expect(sites[0].name).toBe('example.com');
  });

  test('respects schedule when not ignoring it', () => {
    const sites = resolveTargets({ file: tmpPath, now: new Date('2024-01-02T01:00:00Z'), respectSchedule: true });
    expect(sites).toHaveLength(0);
  });

  test('ignores schedule when requested', () => {
    const sites = resolveTargets({ file: tmpPath, now: new Date('2024-01-02T01:00:00Z'), respectSchedule: false });
    expect(sites).toHaveLength(1);
    expect(sites[0].name).toBe('example.com');
  });

  test('creates adhoc target when filter missing and allowed', () => {
    const sites = resolveTargets({ file: tmpPath, filter: 'missing.com', allowAdhoc: true, respectSchedule: false });
    expect(sites).toHaveLength(1);
    expect(sites[0].name).toBe('missing.com');
    expect(sites[0].baseUrl).toBe('https://missing.com');
    expect(sites[0].mode).toBe('sitemap');
    expect(sites[0].label).toBe('missing.com');
  });
});
