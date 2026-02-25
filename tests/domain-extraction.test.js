import { extractDomain } from '../scripts/generate-report.js';

describe('domain extraction for trend grouping', () => {
  test('extracts domain from https URL', () => {
    expect(extractDomain('https://www.example.com/path/to/page')).toBe('www.example.com');
  });

  test('extracts domain from http URL', () => {
    expect(extractDomain('http://example.com/page')).toBe('example.com');
  });

  test('handles URL with port', () => {
    expect(extractDomain('https://example.com:8080/page')).toBe('example.com');
  });

  test('handles URL with subdomain', () => {
    expect(extractDomain('https://subdomain.example.com/page')).toBe('subdomain.example.com');
  });

  test('handles URL with query parameters', () => {
    expect(extractDomain('https://www.example.com/page?query=value')).toBe('www.example.com');
  });

  test('handles URL with hash', () => {
    expect(extractDomain('https://www.example.com/page#section')).toBe('www.example.com');
  });

  test('returns empty string for invalid URL', () => {
    expect(extractDomain('not a url')).toBe('');
  });

  test('returns empty string for null', () => {
    expect(extractDomain(null)).toBe('');
  });

  test('returns empty string for undefined', () => {
    expect(extractDomain(undefined)).toBe('');
  });

  test('returns empty string for empty string', () => {
    expect(extractDomain('')).toBe('');
  });

  test('handles trailing slash in URL', () => {
    expect(extractDomain('https://www.example.com/')).toBe('www.example.com');
  });
});
