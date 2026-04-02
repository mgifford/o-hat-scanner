import { validateSchema, sanitizeLabel, domainSlugFromUrl, buildRunId, createEmptyResult } from '../scripts/shared-schema.js';

describe('validateSchema', () => {
  const validData = {
    runId: 'example-run-1',
    startedAt: '2024-01-01T00:00:00Z',
    finishedAt: '2024-01-01T00:01:00Z',
    toolVersion: '1.0.0',
    mode: 'ci',
    config: { maxPages: 10 },
    targets: ['https://example.com'],
    resultsByUrl: {}
  };

  test('accepts valid schema', () => {
    expect(validateSchema(validData)).toBe(true);
  });

  test('accepts standalone mode', () => {
    expect(validateSchema({ ...validData, mode: 'standalone' })).toBe(true);
  });

  test('throws on missing runId', () => {
    const { runId: _, ...rest } = validData;
    expect(() => validateSchema(rest)).toThrow(/missing field runId/);
  });

  test('throws on missing startedAt', () => {
    const { startedAt: _, ...rest } = validData;
    expect(() => validateSchema(rest)).toThrow(/missing field startedAt/);
  });

  test('throws on missing finishedAt', () => {
    const { finishedAt: _, ...rest } = validData;
    expect(() => validateSchema(rest)).toThrow(/missing field finishedAt/);
  });

  test('throws on missing toolVersion', () => {
    const { toolVersion: _, ...rest } = validData;
    expect(() => validateSchema(rest)).toThrow(/missing field toolVersion/);
  });

  test('throws on missing mode', () => {
    const { mode: _, ...rest } = validData;
    expect(() => validateSchema(rest)).toThrow(/missing field mode/);
  });

  test('throws on missing config', () => {
    const { config: _, ...rest } = validData;
    expect(() => validateSchema(rest)).toThrow(/missing field config/);
  });

  test('throws on missing targets', () => {
    const { targets: _, ...rest } = validData;
    expect(() => validateSchema(rest)).toThrow(/missing field targets/);
  });

  test('throws on missing resultsByUrl', () => {
    const { resultsByUrl: _, ...rest } = validData;
    expect(() => validateSchema(rest)).toThrow(/missing field resultsByUrl/);
  });

  test('throws on invalid mode', () => {
    expect(() => validateSchema({ ...validData, mode: 'unknown' })).toThrow(/Invalid mode/);
  });
});

describe('sanitizeLabel', () => {
  test('converts to lowercase and replaces special chars with hyphens', () => {
    expect(sanitizeLabel('Hello World!')).toBe('hello-world');
  });

  test('trims leading and trailing hyphens', () => {
    expect(sanitizeLabel('--test--')).toBe('test');
  });

  test('collapses consecutive hyphens', () => {
    expect(sanitizeLabel('foo   bar')).toBe('foo-bar');
  });

  test('returns run for empty input', () => {
    expect(sanitizeLabel('')).toBe('run');
    expect(sanitizeLabel()).toBe('run');
  });

  test('preserves alphanumeric characters', () => {
    expect(sanitizeLabel('abc123')).toBe('abc123');
  });

  test('handles special characters in middle', () => {
    expect(sanitizeLabel('Health*Check 2024')).toBe('health-check-2024');
  });
});

describe('domainSlugFromUrl', () => {
  test('extracts and slugifies hostname', () => {
    expect(domainSlugFromUrl('https://www.example.com/path')).toBe('www-example-com');
  });

  test('replaces dots with hyphens', () => {
    expect(domainSlugFromUrl('https://my.site.gov')).toBe('my-site-gov');
  });

  test('returns empty string for null/undefined input', () => {
    expect(domainSlugFromUrl(null)).toBe('');
    expect(domainSlugFromUrl(undefined)).toBe('');
    expect(domainSlugFromUrl('')).toBe('');
  });

  test('returns empty string for invalid URL', () => {
    expect(domainSlugFromUrl('not-a-url')).toBe('');
  });
});

describe('buildRunId', () => {
  beforeEach(() => {
    process.env.RUN_TIMESTAMP = '2024-06-15T10:00:00.000Z';
  });

  afterEach(() => {
    delete process.env.RUN_TIMESTAMP;
  });

  test('includes domain slug and timestamp', () => {
    const id = buildRunId({ label: '', baseUrl: 'https://example.com' });
    expect(id).toContain('example-com');
    expect(id).toContain('2024-06-15');
  });

  test('appends sanitized label when provided', () => {
    const id = buildRunId({ label: 'My Label!', baseUrl: 'https://example.com' });
    expect(id).toMatch(/--my-label$/);
  });

  test('uses first target when no baseUrl', () => {
    const id = buildRunId({ label: '', baseUrl: '', targets: ['https://target.org'] });
    expect(id).toContain('target-org');
  });

  test('handles string input (legacy form)', () => {
    const id = buildRunId('label-only');
    expect(id).toMatch(/--label-only$/);
  });

  test('handles string input with options object', () => {
    const id = buildRunId('my-label', { baseUrl: 'https://site.com' });
    expect(id).toContain('site-com');
    expect(id).toMatch(/--my-label$/);
  });

  test('produces no domain prefix when neither baseUrl nor targets given', () => {
    const id = buildRunId({ label: '' });
    // Should start with the timestamp directly (no domain prefix)
    expect(id).toMatch(/^2024-06-15/);
  });

  test('respects RUN_TIMESTAMP env override', () => {
    process.env.RUN_TIMESTAMP = '2025-01-01T00:00:00.000Z';
    const id = buildRunId({ label: 'test', baseUrl: 'https://example.com' });
    expect(id).toContain('2025-01-01');
  });

  test('ignores invalid RUN_TIMESTAMP override', () => {
    process.env.RUN_TIMESTAMP = 'not-a-date';
    // Should not throw; falls back to real clock or still produces a valid id
    expect(() => buildRunId({ label: '' })).not.toThrow();
  });
});

describe('createEmptyResult', () => {
  beforeEach(() => {
    process.env.RUN_TIMESTAMP = '2024-06-15T10:00:00.000Z';
  });

  afterEach(() => {
    delete process.env.RUN_TIMESTAMP;
  });

  test('creates result with all required fields', () => {
    const result = createEmptyResult('ci', { maxPages: 20, baseUrl: 'https://example.com' }, ['https://example.com']);
    expect(result.runId).toBeTruthy();
    expect(result.startedAt).toBeTruthy();
    expect(result.finishedAt).toBeNull();
    expect(result.toolVersion).toBe('1.0.0');
    expect(result.mode).toBe('ci');
    expect(result.targets).toEqual(['https://example.com']);
    expect(result.resultsByUrl).toEqual({});
  });

  test('uses label from config when not provided explicitly', () => {
    const result = createEmptyResult('ci', { label: 'my-label', baseUrl: 'https://example.com' }, []);
    expect(result.config.label).toBe('my-label');
  });

  test('uses explicit label argument, overriding config', () => {
    const result = createEmptyResult('ci', { label: 'config-label' }, [], 'explicit-label');
    expect(result.config.label).toBe('explicit-label');
  });

  test('accepts standalone mode', () => {
    const result = createEmptyResult('standalone', {}, []);
    expect(result.mode).toBe('standalone');
  });

  test('handles null/undefined targets gracefully', () => {
    const result = createEmptyResult('ci', {}, null);
    expect(result.targets).toEqual([]);
  });

  test('preserves arbitrary config fields', () => {
    const result = createEmptyResult('ci', { foo: 'bar', maxPages: 5 }, []);
    expect(result.config.foo).toBe('bar');
    expect(result.config.maxPages).toBe(5);
  });
});
