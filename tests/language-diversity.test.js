import { detectLanguageCode, normalizePathForGrouping, applyLanguageDiversity } from '../scripts/scan-ci.js';

describe('Language detection and diversity', () => {
  describe('detectLanguageCode', () => {
    test('detects /en/ pattern', () => {
      expect(detectLanguageCode('https://example.com/en/services')).toBe('en');
      expect(detectLanguageCode('https://example.com/en/about/team')).toBe('en');
    });

    test('detects /fr/ pattern', () => {
      expect(detectLanguageCode('https://example.com/fr/services')).toBe('fr');
    });

    test('detects language at domain level', () => {
      expect(detectLanguageCode('https://en.example.com/services')).toBe('en');
      expect(detectLanguageCode('https://fr.example.com/services')).toBe('fr');
    });

    test('detects -en suffix in path', () => {
      expect(detectLanguageCode('https://example.com/services-en')).toBe('en');
      expect(detectLanguageCode('https://example.com/about-fr')).toBe('fr');
    });

    test('returns null for URLs without language code', () => {
      expect(detectLanguageCode('https://example.com/services')).toBeNull();
      expect(detectLanguageCode('https://example.com/about')).toBeNull();
    });

    test('handles two-part language codes', () => {
      expect(detectLanguageCode('https://example.com/en-us/services')).toBe('en-us');
      expect(detectLanguageCode('https://example.com/fr-ca/about')).toBe('fr-ca');
    });
  });

  describe('normalizePathForGrouping', () => {
    test('removes /en/ from path', () => {
      expect(normalizePathForGrouping('https://example.com/en/services', 'en'))
        .toBe('https://example.com/services');
      expect(normalizePathForGrouping('https://example.com/en/about/team', 'en'))
        .toBe('https://example.com/about/team');
    });

    test('removes /fr/ from path', () => {
      expect(normalizePathForGrouping('https://example.com/fr/services', 'fr'))
        .toBe('https://example.com/services');
    });

    test('removes language from domain', () => {
      expect(normalizePathForGrouping('https://en.example.com/services', 'en'))
        .toBe('https://example.com/services');
      expect(normalizePathForGrouping('https://fr.example.com/services', 'fr'))
        .toBe('https://example.com/services');
    });

    test('removes -en suffix', () => {
      expect(normalizePathForGrouping('https://example.com/services-en', 'en'))
        .toBe('https://example.com/services');
    });

    test('returns original URL if no language code', () => {
      expect(normalizePathForGrouping('https://example.com/services', null))
        .toBe('https://example.com/services');
    });

    test('handles two-part language codes', () => {
      expect(normalizePathForGrouping('https://example.com/en-us/services', 'en-us'))
        .toBe('https://example.com/services');
    });
  });

  describe('applyLanguageDiversity', () => {
    test('keeps all URLs when no duplicates exist', () => {
      const urls = [
        'https://example.com/page1',
        'https://example.com/page2',
        'https://example.com/page3'
      ];
      const result = applyLanguageDiversity(urls);
      expect(result).toEqual(urls);
      expect(result.length).toBe(3);
    });

    test('keeps only 2 languages for the same base page', () => {
      const urls = [
        'https://example.com/en/services',
        'https://example.com/fr/services',
        'https://example.com/es/services',
        'https://example.com/de/services'
      ];
      const result = applyLanguageDiversity(urls);
      expect(result.length).toBe(2);
      // Should contain 2 different languages
      const languages = result.map(url => detectLanguageCode(url));
      expect(new Set(languages).size).toBe(2);
    });

    test('distributes languages across multiple pages', () => {
      const urls = [
        'https://example.com/en/services',
        'https://example.com/fr/services',
        'https://example.com/en/about',
        'https://example.com/fr/about',
        'https://example.com/en/contact',
        'https://example.com/fr/contact'
      ];
      const result = applyLanguageDiversity(urls);
      // Should have 6 URLs (2 languages × 3 pages)
      expect(result.length).toBe(6);
      
      // Check that each page has exactly 2 language versions
      const grouped = {};
      result.forEach(url => {
        const lang = detectLanguageCode(url);
        const normalized = normalizePathForGrouping(url, lang);
        grouped[normalized] = (grouped[normalized] || 0) + 1;
      });
      
      Object.values(grouped).forEach(count => {
        expect(count).toBeLessThanOrEqual(2);
      });
    });

    test('handles mixed content (with and without language codes)', () => {
      const urls = [
        'https://example.com/en/services',
        'https://example.com/fr/services',
        'https://example.com/about', // no language
        'https://example.com/en/contact',
        'https://example.com/fr/contact'
      ];
      const result = applyLanguageDiversity(urls);
      // Should have 5 URLs: /about (no lang), 2 for /services, 2 for /contact
      expect(result.length).toBe(5);
      expect(result).toContain('https://example.com/about');
    });

    test('prefers first 2 languages encountered', () => {
      const urls = [
        'https://example.com/en/services',
        'https://example.com/fr/services',
        'https://example.com/es/services',
        'https://example.com/de/services',
        'https://example.com/it/services'
      ];
      const result = applyLanguageDiversity(urls);
      expect(result.length).toBe(2);
      // Should keep first 2 (en and fr)
      expect(result).toContain('https://example.com/en/services');
      expect(result).toContain('https://example.com/fr/services');
    });

    test('works with subdomain-based languages', () => {
      const urls = [
        'https://en.example.com/services',
        'https://fr.example.com/services',
        'https://es.example.com/services'
      ];
      const result = applyLanguageDiversity(urls);
      expect(result.length).toBe(2);
    });

    test('promotes language diversity across the full scan', () => {
      const urls = [
        'https://example.com/en/page1',
        'https://example.com/fr/page1',
        'https://example.com/es/page1',
        'https://example.com/en/page2',
        'https://example.com/fr/page2',
        'https://example.com/es/page2'
      ];
      const result = applyLanguageDiversity(urls);
      
      // Count total occurrences of each language
      const langCounts = {};
      result.forEach(url => {
        const lang = detectLanguageCode(url);
        langCounts[lang] = (langCounts[lang] || 0) + 1;
      });
      
      // Should have good distribution, not all from just 2 languages
      // With 2 pages and 3 languages, we should get 4 URLs
      expect(result.length).toBe(4);
      
      // At least 2 different languages should be represented
      expect(Object.keys(langCounts).length).toBeGreaterThanOrEqual(2);
    });
  });
});
