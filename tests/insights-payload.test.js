import { buildInsightsPayload } from '../scripts/generate-report.js';

// Shared fixtures
const RESULTS = {
    startedAt: '2026-01-21T10:00:00Z',
    mode: 'ci',
    targets: ['https://example.com'],
    config: { viewport: 'desktop', colorScheme: 'light', browser: 'chromium' },
    resultsByUrl: {
        'https://example.com/page1': {
            title: 'Home',
            violations: [
                {
                    id: 'color-contrast',
                    impact: 'serious',
                    help: 'Ensure sufficient color contrast',
                    helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/color-contrast',
                    tags: ['wcag2aa', 'wcag143'],
                    nodes: [
                        { target: ['p.text'], html: '<p class="text">...</p>', failureSummary: 'Fix contrast' },
                        { target: ['span.muted'], html: '<span class="muted">...</span>', failureSummary: 'Fix contrast' }
                    ]
                },
                {
                    id: 'aria-input-field-name',
                    impact: 'critical',
                    help: 'Form inputs must have accessible names',
                    helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/aria-input-field-name',
                    tags: ['wcag2a', 'wcag412'],
                    nodes: [
                        { target: ['input#email'], html: '<input id="email">', failureSummary: 'Add label' }
                    ]
                }
            ]
        },
        'https://example.com/page2': {
            title: 'About',
            violations: [
                {
                    id: 'color-contrast',
                    impact: 'serious',
                    help: 'Ensure sufficient color contrast',
                    helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/color-contrast',
                    tags: ['wcag2aa', 'wcag143'],
                    nodes: [
                        { target: ['h2.title'], html: '<h2 class="title">...</h2>', failureSummary: 'Fix contrast' }
                    ]
                }
            ]
        }
    }
};

const PAGE_STATS = {
    pagesScanned: 2,
    mustFixCount: 4,
    goodToFixCount: 0,
    reviewCount: 0,
    pagesWithIssues: 2,
    automationCoverage: 100
};

describe('buildInsightsPayload', () => {
    test('returns an object with scan, trends, recommended_priorities, and constraints', () => {
        const payload = buildInsightsPayload('run-2026-01-21', RESULTS, PAGE_STATS, []);
        expect(payload).toHaveProperty('scan');
        expect(payload).toHaveProperty('trends');
        expect(payload).toHaveProperty('recommended_priorities');
        expect(payload).toHaveProperty('constraints');
    });

    test('scan summary contains correct counts', () => {
        const payload = buildInsightsPayload('run-2026-01-21', RESULTS, PAGE_STATS, []);
        const { scan } = payload;
        expect(scan.date).toBe('2026-01-21');
        expect(scan.pages_scanned).toBe(2);
        // 2 nodes (serious) + 1 node (serious) + 1 node (critical) = 4 total
        expect(scan.violations_total).toBe(4);
        expect(scan.by_impact.critical).toBe(1);
        expect(scan.by_impact.serious).toBe(3);
        expect(scan.by_impact.moderate).toBe(0);
        expect(scan.by_impact.minor).toBe(0);
    });

    test('top_rules includes pages_affected count', () => {
        const payload = buildInsightsPayload('run-2026-01-21', RESULTS, PAGE_STATS, []);
        const { scan } = payload;
        // color-contrast should appear on 2 pages
        const contrastRule = scan.top_rules.find(r => r.rule_id === 'color-contrast');
        expect(contrastRule).toBeDefined();
        expect(contrastRule.pages_affected).toBe(2);
        expect(contrastRule.count).toBe(3);
    });

    test('top_rules includes prioritization score (impact × pages × count)', () => {
        const payload = buildInsightsPayload('run-2026-01-21', RESULTS, PAGE_STATS, []);
        const { scan } = payload;
        // aria-input-field-name: critical (weight 10) × 1 page × 1 node = 10
        const formRule = scan.top_rules.find(r => r.rule_id === 'aria-input-field-name');
        expect(formRule).toBeDefined();
        expect(formRule.score).toBe(10); // 10 * 1 * 1
        // color-contrast: serious (weight 5) × 2 pages × 3 nodes = 30
        const contrastRule = scan.top_rules.find(r => r.rule_id === 'color-contrast');
        expect(contrastRule.score).toBe(30); // 5 * 2 * 3
    });

    test('top_rules sorted by score descending', () => {
        const payload = buildInsightsPayload('run-2026-01-21', RESULTS, PAGE_STATS, []);
        const scores = payload.scan.top_rules.map(r => r.score);
        for (let i = 1; i < scores.length; i++) {
            expect(scores[i - 1]).toBeGreaterThanOrEqual(scores[i]);
        }
    });

    test('recommended_priorities contains top 5 (or fewer) rules', () => {
        const payload = buildInsightsPayload('run-2026-01-21', RESULTS, PAGE_STATS, []);
        expect(payload.recommended_priorities.length).toBeLessThanOrEqual(5);
        expect(payload.recommended_priorities.length).toBeGreaterThan(0);
    });

    test('constraints.no_invented_numbers is true', () => {
        const payload = buildInsightsPayload('run-2026-01-21', RESULTS, PAGE_STATS, []);
        expect(payload.constraints.no_invented_numbers).toBe(true);
    });

    test('trends.series contains current run as last entry', () => {
        const payload = buildInsightsPayload('run-2026-01-21', RESULTS, PAGE_STATS, []);
        const { trends } = payload;
        const last = trends.series[trends.series.length - 1];
        expect(last.run_id).toBe('run-2026-01-21');
        expect(last.violations_total).toBe(4);
    });

    test('trends.series is sorted chronologically', () => {
        const priorRows = [
            { metricType: 'summary', target: 'example.com', viewport: 'desktop', colorScheme: 'light', browser: 'chromium', runId: 'run-prev-1', startedAt: '2025-10-01T00:00:00Z', pagesScanned: 10, totalViolations: 20, critical: 2, serious: 5, moderate: 8, minor: 5 },
            { metricType: 'summary', target: 'example.com', viewport: 'desktop', colorScheme: 'light', browser: 'chromium', runId: 'run-prev-2', startedAt: '2025-11-01T00:00:00Z', pagesScanned: 11, totalViolations: 18, critical: 1, serious: 4, moderate: 8, minor: 5 }
        ];
        const payload = buildInsightsPayload('run-2026-01-21', RESULTS, PAGE_STATS, priorRows);
        const { series } = payload.trends;
        for (let i = 1; i < series.length; i++) {
            expect(new Date(series[i].date) >= new Date(series[i - 1].date)).toBe(true);
        }
    });

    test('trends.delta_vs_last is null when no prior runs', () => {
        const payload = buildInsightsPayload('run-2026-01-21', RESULTS, PAGE_STATS, []);
        expect(payload.trends.delta_vs_last).toBeNull();
    });

    test('trends.delta_vs_last computed correctly vs prior run', () => {
        const priorRows = [
            { metricType: 'summary', target: 'example.com', viewport: 'desktop', colorScheme: 'light', browser: 'chromium', runId: 'run-prev', startedAt: '2025-12-01T00:00:00Z', pagesScanned: 2, totalViolations: 6, critical: 2, serious: 2, moderate: 1, minor: 1 }
        ];
        const payload = buildInsightsPayload('run-2026-01-21', RESULTS, PAGE_STATS, priorRows);
        const delta = payload.trends.delta_vs_last;
        expect(delta).not.toBeNull();
        expect(delta.violations_total).toBe(4 - 6); // current(4) - prev(6) = -2
        expect(delta.critical).toBe(1 - 2);         // -1
        expect(delta.serious).toBe(3 - 2);           // +1
    });

    test('trends.new_rules detects rule IDs not seen in prior runs', () => {
        const priorRows = [
            { metricType: 'rule', target: 'example.com', runId: 'run-prev', metricId: 'color-contrast', metricCount: 5 }
        ];
        const payload = buildInsightsPayload('run-2026-01-21', RESULTS, PAGE_STATS, priorRows);
        // aria-input-field-name was NOT in priorRows
        expect(payload.trends.new_rules).toContain('aria-input-field-name');
        // color-contrast WAS in priorRows
        expect(payload.trends.new_rules).not.toContain('color-contrast');
    });

    test('trends.new_rules is empty array when all rules were seen before', () => {
        const priorRows = [
            { metricType: 'rule', target: 'example.com', runId: 'run-prev', metricId: 'color-contrast', metricCount: 5 },
            { metricType: 'rule', target: 'example.com', runId: 'run-prev', metricId: 'aria-input-field-name', metricCount: 3 }
        ];
        const payload = buildInsightsPayload('run-2026-01-21', RESULTS, PAGE_STATS, priorRows);
        expect(payload.trends.new_rules).toHaveLength(0);
    });

    test('filters history by matching target, viewport, colorScheme, browser', () => {
        const priorRows = [
            // Matching run
            { metricType: 'summary', target: 'example.com', viewport: 'desktop', colorScheme: 'light', browser: 'chromium', runId: 'run-match', startedAt: '2025-12-01T00:00:00Z', pagesScanned: 5, totalViolations: 10, critical: 1, serious: 2, moderate: 4, minor: 3 },
            // Non-matching (different viewport)
            { metricType: 'summary', target: 'example.com', viewport: 'mobile', colorScheme: 'light', browser: 'chromium', runId: 'run-mobile', startedAt: '2025-12-01T00:00:00Z', pagesScanned: 5, totalViolations: 15, critical: 3, serious: 4, moderate: 5, minor: 3 },
            // Non-matching (different target)
            { metricType: 'summary', target: 'other.com', viewport: 'desktop', colorScheme: 'light', browser: 'chromium', runId: 'run-other', startedAt: '2025-12-01T00:00:00Z', pagesScanned: 5, totalViolations: 20, critical: 5, serious: 5, moderate: 5, minor: 5 }
        ];
        const payload = buildInsightsPayload('run-2026-01-21', RESULTS, PAGE_STATS, priorRows);
        // Should include only run-match + current run = 2 entries
        expect(payload.trends.series).toHaveLength(2);
        expect(payload.trends.series[0].run_id).toBe('run-match');
        expect(payload.trends.series[1].run_id).toBe('run-2026-01-21');
    });

    test('limits history to last 9 prior runs (10 total including current)', () => {
        const priorRows = Array.from({ length: 15 }, (_, i) => ({
            metricType: 'summary',
            target: 'example.com',
            viewport: 'desktop',
            colorScheme: 'light',
            browser: 'chromium',
            runId: 'run-' + (i + 1),
            startedAt: '2025-0' + (Math.floor(i / 5) + 1) + '-' + String(i + 1).padStart(2, '0') + 'T00:00:00Z',
            pagesScanned: 10,
            totalViolations: 20 + i,
            critical: 1, serious: 2, moderate: 10, minor: 7
        }));
        const payload = buildInsightsPayload('run-current', RESULTS, PAGE_STATS, priorRows);
        // Max 9 prior + 1 current = 10
        expect(payload.trends.series.length).toBeLessThanOrEqual(10);
    });

    test('serializes to valid JSON (no circular refs)', () => {
        const payload = buildInsightsPayload('run-2026-01-21', RESULTS, PAGE_STATS, []);
        expect(() => JSON.stringify(payload)).not.toThrow();
    });
});
