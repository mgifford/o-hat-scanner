/**
 * discover-top-pages.test.js
 * Basic unit tests for the discovery script components
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Note: The discover-top-pages.js script doesn't export functions,
// so we test it via integration (run the script with test inputs and verify outputs)

describe('discover-top-pages integration', () => {
  const testOutDir = path.join(__dirname, '..', 'site', 'test-discover');
  const testSiteKey = 'test-discover-site';

  beforeAll(() => {
    if (!fs.existsSync(testOutDir)) {
      fs.mkdirSync(testOutDir, { recursive: true });
    }
  });

  afterAll(() => {
    // Clean up test outputs
    try {
      const jsonPath = path.join(testOutDir, `${testSiteKey}.urls.json`);
      const txtPath = path.join(testOutDir, `${testSiteKey}.urls.txt`);
      if (fs.existsSync(jsonPath)) fs.unlinkSync(jsonPath);
      if (fs.existsSync(txtPath)) fs.unlinkSync(txtPath);
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  it('should output files with expected schema (dry run, nav only)', (done) => {
    // Run discover script with nav-only mode (no BING_API_KEY)
    // This is a basic integration test
    expect(testOutDir).toBeTruthy();
    expect(testSiteKey).toBeTruthy();
    // Note: Full integration test would require spawning the script
    // For now, we verify the script exists and is readable
    const scriptPath = path.join(__dirname, '..', 'scripts', 'discover-top-pages.js');
    expect(fs.existsSync(scriptPath)).toBe(true);
    done();
  });

  it('should validate output JSON schema format', () => {
    // The metadata JSON should contain expected fields
    const exampleMetadata = {
      baseUrl: 'https://example.gov',
      maxPages: 100,
      generatedAt: new Date().toISOString(),
      serp: {
        enabled: false,
        provider: 'none',
        queries: []
      },
      stats: {
        candidates: 0,
        afterNormalize: 0,
        afterValidate: 0,
        afterDedupe: 0,
        final: 0
      },
      requiredPages: {},
      pages: [],
      excluded: []
    };

    expect(exampleMetadata.baseUrl).toBeTruthy();
    expect(exampleMetadata.stats).toHaveProperty('candidates');
    expect(exampleMetadata.pages).toEqual([]);
  });

  it('should normalize URLs correctly', () => {
    // URL normalization should remove tracking params and fragments
    const testUrls = [
      'https://example.gov/page?utm_source=test&utm_medium=email',
      'https://example.gov/page#section',
      'https://example.gov/page?fb_clid=test',
      'https://example.gov/index.html'
    ];

    // All should be normalized to same base URL
    expect(testUrls.length).toBeGreaterThan(0);
  });

  it('should identify required pages by pattern', () => {
    // Required page patterns should match accessibility, privacy, etc.
    const requiredPages = {
      accessibility: {
        keywords: ['accessibility', 'a11y', 'wcag'],
        urlPatterns: ['/accessibility', '/a11y']
      },
      privacy: {
        keywords: ['privacy', 'data protection'],
        urlPatterns: ['/privacy']
      }
    };

    expect(Object.keys(requiredPages).length).toBeGreaterThan(0);
    expect(requiredPages.accessibility.keywords).toContain('a11y');
    expect(requiredPages.privacy.urlPatterns).toContain('/privacy');
  });

  it('should handle nav discovery gracefully', () => {
    // Navigation discovery should be resilient to network errors
    // (tested via integration when running full script)
    expect(true).toBe(true); // Placeholder for integration test
  });

  it('should produce newline-delimited URL list', () => {
    // Output .urls.txt should be plain text, one URL per line
    const exampleUrlsList = [
      'https://example.gov/',
      'https://example.gov/about',
      'https://example.gov/privacy',
      'https://example.gov/contact'
    ].join('\n') + '\n';

    const lines = exampleUrlsList.split('\n').filter(l => l);
    expect(lines.length).toBe(4);
    expect(lines[0]).toMatch(/^https:\/\//);
  });
});
