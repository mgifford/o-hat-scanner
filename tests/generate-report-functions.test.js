import { analyzeResults, mapSeverity, getTopPages, getIssuesByViolationType, countTotalNodes } from '../scripts/generate-report.js';

describe('mapSeverity', () => {
  test('maps critical impact to critical', () => {
    expect(mapSeverity('critical')).toBe('critical');
  });

  test('maps serious impact to critical', () => {
    expect(mapSeverity('serious')).toBe('critical');
  });

  test('maps moderate impact to moderate', () => {
    expect(mapSeverity('moderate')).toBe('moderate');
  });

  test('maps minor impact to moderate', () => {
    expect(mapSeverity('minor')).toBe('moderate');
  });

  test('maps review impact to review', () => {
    expect(mapSeverity('review')).toBe('review');
  });

  test('returns review for unknown impact', () => {
    expect(mapSeverity('unknown')).toBe('review');
    expect(mapSeverity('')).toBe('review');
    expect(mapSeverity(undefined)).toBe('review');
    expect(mapSeverity(null)).toBe('review');
  });
});

const makeResults = (overrides = {}) => ({
  resultsByUrl: {
    'https://example.com/page1': {
      title: 'Page One',
      violations: [
        {
          id: 'color-contrast',
          impact: 'serious',
          help: 'Elements must have sufficient color contrast',
          nodes: [{ target: ['p.text'], html: '<p>', failureSummary: 'Fix contrast' }]
        },
        {
          id: 'image-alt',
          impact: 'critical',
          help: 'Images must have alt text',
          nodes: [
            { target: ['img.hero'], html: '<img>', failureSummary: 'Add alt' },
            { target: ['img.logo'], html: '<img>', failureSummary: 'Add alt' }
          ]
        }
      ]
    },
    'https://example.com/page2': {
      title: 'Page Two',
      violations: [
        {
          id: 'label',
          impact: 'moderate',
          help: 'Form elements must have labels',
          nodes: [{ target: ['input'], html: '<input>', failureSummary: 'Add label' }]
        }
      ]
    },
    'https://example.com/page3': {
      title: 'Page Three',
      violations: []
    },
    ...overrides
  }
});

describe('analyzeResults', () => {
  test('counts pages scanned correctly', () => {
    const stats = analyzeResults(makeResults());
    expect(stats.pagesScanned).toBe(3);
  });

  test('counts pages with issues', () => {
    const stats = analyzeResults(makeResults());
    expect(stats.pagesWithIssues).toBe(2); // page3 has no violations
  });

  test('counts mustFixCount (critical+serious nodes)', () => {
    const stats = analyzeResults(makeResults());
    // color-contrast (serious → critical): 1 node, image-alt (critical): 2 nodes = 3
    expect(stats.mustFixCount).toBe(3);
  });

  test('counts goodToFixCount (moderate+minor nodes)', () => {
    const stats = analyzeResults(makeResults());
    // label (moderate): 1 node
    expect(stats.goodToFixCount).toBe(1);
  });

  test('handles empty resultsByUrl', () => {
    const stats = analyzeResults({ resultsByUrl: {} });
    expect(stats.pagesScanned).toBe(0);
    expect(stats.pagesWithIssues).toBe(0);
    expect(stats.mustFixCount).toBe(0);
    expect(stats.goodToFixCount).toBe(0);
    expect(stats.reviewCount).toBe(0);
    expect(stats.automationCoverage).toBe(0);
  });

  test('counts review violations separately', () => {
    const results = {
      resultsByUrl: {
        'https://example.com/page': {
          violations: [
            {
              id: 'frame-title',
              impact: 'review',
              help: 'Frames must have a title',
              nodes: [{ target: ['iframe'], html: '<iframe>', failureSummary: 'Add title' }]
            }
          ]
        }
      }
    };
    const stats = analyzeResults(results);
    expect(stats.reviewCount).toBe(1);
    expect(stats.mustFixCount).toBe(0);
    expect(stats.goodToFixCount).toBe(0);
  });

  test('tracks pages with errors for automation coverage', () => {
    const results = {
      resultsByUrl: {
        'https://example.com/ok': { violations: [] },
        'https://example.com/err': { violations: [], error: 'timeout' }
      }
    };
    const stats = analyzeResults(results);
    expect(stats.automationCoverage).toBe(50); // 1/2 pages without error
  });
});

describe('getTopPages', () => {
  test('returns top 5 pages by violation count', () => {
    const manyResults = { resultsByUrl: {} };
    for (let i = 1; i <= 10; i++) {
      manyResults.resultsByUrl[`https://example.com/page${i}`] = {
        violations: [{
          id: 'color-contrast',
          impact: 'critical',
          nodes: Array.from({ length: i }, (_, j) => ({ target: [`el${j}`], html: '', failureSummary: '' }))
        }]
      };
    }
    const top = getTopPages(manyResults);
    expect(top).toHaveLength(5);
    expect(top[0].count).toBeGreaterThanOrEqual(top[1].count);
  });

  test('excludes pages with zero violations', () => {
    const results = makeResults();
    const top = getTopPages(results);
    const urls = top.map(p => p.url);
    expect(urls).not.toContain('https://example.com/page3');
  });

  test('returns url, count, severity, violations, title for each entry', () => {
    const top = getTopPages(makeResults());
    for (const page of top) {
      expect(page).toHaveProperty('url');
      expect(page).toHaveProperty('count');
      expect(page).toHaveProperty('severity');
      expect(page).toHaveProperty('violations');
      expect(page).toHaveProperty('title');
    }
  });

  test('returns empty array when no pages have violations', () => {
    const results = { resultsByUrl: { 'https://example.com/ok': { violations: [] } } };
    expect(getTopPages(results)).toHaveLength(0);
  });

  test('handles missing violations array gracefully', () => {
    const results = { resultsByUrl: { 'https://example.com/ok': {} } };
    expect(() => getTopPages(results)).not.toThrow();
    expect(getTopPages(results)).toHaveLength(0);
  });
});

describe('getIssuesByViolationType', () => {
  test('groups violations by id for the given severity', () => {
    const issues = getIssuesByViolationType(makeResults(), 'critical');
    // critical severity includes serious+critical → color-contrast and image-alt
    const ids = issues.map(i => i.violationId);
    expect(ids).toContain('color-contrast');
    expect(ids).toContain('image-alt');
    expect(ids).not.toContain('label'); // label is moderate
  });

  test('groups violations by id for moderate severity', () => {
    const issues = getIssuesByViolationType(makeResults(), 'moderate');
    const ids = issues.map(i => i.violationId);
    expect(ids).toContain('label');
    expect(ids).not.toContain('image-alt');
  });

  test('groups pages under same violation', () => {
    const results = {
      resultsByUrl: {
        'https://example.com/page1': {
          violations: [{ id: 'color-contrast', impact: 'serious', help: 'Contrast', nodes: [{ target: [], html: '', failureSummary: '' }] }]
        },
        'https://example.com/page2': {
          violations: [{ id: 'color-contrast', impact: 'serious', help: 'Contrast', nodes: [{ target: [], html: '', failureSummary: '' }] }]
        }
      }
    };
    const issues = getIssuesByViolationType(results, 'critical');
    expect(issues).toHaveLength(1);
    expect(issues[0].pages.size).toBe(2);
  });

  test('returns empty array when no matching violations', () => {
    const issues = getIssuesByViolationType(makeResults(), 'review');
    expect(issues).toHaveLength(0);
  });
});

describe('countTotalNodes', () => {
  test('sums nodes across all issues and pages', () => {
    const issues = getIssuesByViolationType(makeResults(), 'critical');
    const total = countTotalNodes(issues);
    // color-contrast: 1 node on page1, image-alt: 2 nodes on page1 = 3
    expect(total).toBe(3);
  });

  test('returns 0 for empty array', () => {
    expect(countTotalNodes([])).toBe(0);
  });
});
