import {
    normalizeSelector,
    fingerprintMessage,
    nodeFingerprint,
    buildSignature,
    simpleHash,
    computeComponentHint,
    groupFindings
} from '../scripts/dedupe-utils.js';

import {
    DUPLICATE_FINDINGS,
    SIMILAR_FINDINGS,
    DISTINCT_FINDINGS,
    ALL_FINDINGS
} from './fixtures/dedupe-findings.js';

// ---------------------------------------------------------------------------
// normalizeSelector
// ---------------------------------------------------------------------------
describe('normalizeSelector', () => {
    test('removes :nth-child pseudo-class', () => {
        expect(normalizeSelector('li:nth-child(3)')).toBe('li');
        expect(normalizeSelector('ul li:nth-child(10)')).toBe('ul li');
    });

    test('removes :nth-of-type pseudo-class', () => {
        expect(normalizeSelector('p:nth-of-type(2)')).toBe('p');
    });

    test('replaces long numeric suffix IDs (4+ digits)', () => {
        expect(normalizeSelector('#field-12345')).toBe('#field-*');
        expect(normalizeSelector('#item-9999')).toBe('#item-*');
    });

    test('keeps short numeric suffix IDs (fewer than 4 digits)', () => {
        expect(normalizeSelector('#field-123')).toBe('#field-123');
        expect(normalizeSelector('#item-1')).toBe('#item-1');
    });

    test('collapses multiple whitespace characters', () => {
        expect(normalizeSelector('div   span')).toBe('div span');
    });

    test('returns empty string for null/undefined/empty input', () => {
        expect(normalizeSelector(null)).toBe('');
        expect(normalizeSelector(undefined)).toBe('');
        expect(normalizeSelector('')).toBe('');
    });

    test('nth-child variants normalize to same result', () => {
        expect(normalizeSelector('li:nth-child(1)')).toBe(normalizeSelector('li:nth-child(99)'));
    });
});

// ---------------------------------------------------------------------------
// fingerprintMessage
// ---------------------------------------------------------------------------
describe('fingerprintMessage', () => {
    test('lowercases the message', () => {
        expect(fingerprintMessage('Elements Must Have Contrast')).toBe('elements must have contrast');
    });

    test('replaces numeric values with *', () => {
        const fp = fingerprintMessage('Contrast ratio is 2.5:1');
        expect(fp).not.toContain('2');
        expect(fp).toContain('*');
    });

    test('replaces URLs with *', () => {
        const fp = fingerprintMessage('See https://example.com/docs for details');
        expect(fp).not.toContain('https');
        expect(fp).toBe('see * for details');
    });

    test('trims surrounding whitespace', () => {
        expect(fingerprintMessage('  some message  ')).toBe('some message');
    });

    test('returns empty string for null/undefined input', () => {
        expect(fingerprintMessage(null)).toBe('');
        expect(fingerprintMessage(undefined)).toBe('');
    });

    test('two messages differing only in a number produce the same fingerprint', () => {
        const a = fingerprintMessage('Contrast ratio is 2.5:1, expected 4.5:1');
        const b = fingerprintMessage('Contrast ratio is 3.0:1, expected 4.5:1');
        expect(a).toBe(b);
    });
});

// ---------------------------------------------------------------------------
// buildSignature
// ---------------------------------------------------------------------------
describe('buildSignature', () => {
    const baseFinding = {
        rule_id: 'color-contrast',
        impact: 'serious',
        message: 'Elements must have sufficient color contrast',
        selector: '.text-muted',
        html_snippet: '<p class="text-muted">Content</p>'
    };

    test('same finding produces same signature', () => {
        expect(buildSignature(baseFinding)).toBe(buildSignature({ ...baseFinding }));
    });

    test('different rule_id produces different signature', () => {
        const other = { ...baseFinding, rule_id: 'image-alt' };
        expect(buildSignature(baseFinding)).not.toBe(buildSignature(other));
    });

    test('different impact produces different signature', () => {
        const other = { ...baseFinding, impact: 'critical' };
        expect(buildSignature(baseFinding)).not.toBe(buildSignature(other));
    });

    test('different selector produces different signature', () => {
        const other = { ...baseFinding, selector: '.different-class' };
        expect(buildSignature(baseFinding)).not.toBe(buildSignature(other));
    });

    test('nth-child variants produce the same signature after normalization', () => {
        const a = { ...baseFinding, selector: 'ul li:nth-child(1)' };
        const b = { ...baseFinding, selector: 'ul li:nth-child(5)' };
        expect(buildSignature(a)).toBe(buildSignature(b));
    });

    test('handles missing fields gracefully', () => {
        expect(() => buildSignature({})).not.toThrow();
    });
});

// ---------------------------------------------------------------------------
// simpleHash
// ---------------------------------------------------------------------------
describe('simpleHash', () => {
    test('returns an 8-character hex string', () => {
        const h = simpleHash('test');
        expect(h).toHaveLength(8);
        expect(/^[0-9a-f]{8}$/.test(h)).toBe(true);
    });

    test('same input always produces same hash', () => {
        expect(simpleHash('hello world')).toBe(simpleHash('hello world'));
    });

    test('different strings produce different hashes for common values', () => {
        expect(simpleHash('color-contrast')).not.toBe(simpleHash('image-alt'));
    });

    test('empty string is handled without error', () => {
        expect(() => simpleHash('')).not.toThrow();
        expect(simpleHash('')).toHaveLength(8);
    });
});

// ---------------------------------------------------------------------------
// computeComponentHint
// ---------------------------------------------------------------------------
describe('computeComponentHint', () => {
    test('returns the most common CSS class that appears in more than one example', () => {
        const examples = [
            { selector: '.text-muted span' },
            { selector: '.text-muted p' },
            { selector: '.text-muted div' }
        ];
        expect(computeComponentHint(examples)).toBe('.text-muted');
    });

    test('returns null when no class appears in more than one example', () => {
        const examples = [
            { selector: '.class-a' },
            { selector: '.class-b' }
        ];
        expect(computeComponentHint(examples)).toBeNull();
    });

    test('returns null for a single example', () => {
        expect(computeComponentHint([{ selector: '.foo' }])).toBeNull();
    });

    test('returns null for an empty array', () => {
        expect(computeComponentHint([])).toBeNull();
    });

    test('returns null for null/undefined input', () => {
        expect(computeComponentHint(null)).toBeNull();
        expect(computeComponentHint(undefined)).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// groupFindings – deterministic deduplication
// ---------------------------------------------------------------------------
describe('groupFindings', () => {
    test('10 identical-signature findings collapse to 1 group', () => {
        const groups = groupFindings(DUPLICATE_FINDINGS);
        expect(groups).toHaveLength(1);
        expect(groups[0].count).toBe(10);
        expect(groups[0].rule_id).toBe('color-contrast');
    });

    test('duplicate group has correct pages_affected count', () => {
        const groups = groupFindings(DUPLICATE_FINDINGS);
        expect(groups[0].pages_affected).toBe(10);
    });

    test('10 similar findings with different selectors produce separate groups', () => {
        const groups = groupFindings(SIMILAR_FINDINGS);
        expect(groups).toHaveLength(10);
        groups.forEach(g => {
            expect(g.count).toBe(1);
            expect(g.rule_id).toBe('heading-order');
        });
    });

    test('10 distinct findings each stay in their own group', () => {
        const groups = groupFindings(DISTINCT_FINDINGS);
        expect(groups).toHaveLength(10);
        groups.forEach(g => expect(g.count).toBe(1));
    });

    test('all 30 findings produce 21 total groups (1+10+10)', () => {
        const groups = groupFindings(ALL_FINDINGS);
        expect(groups).toHaveLength(21);
    });

    test('groups are sorted by count descending', () => {
        const groups = groupFindings(ALL_FINDINGS);
        for (let i = 1; i < groups.length; i++) {
            expect(groups[i - 1].count).toBeGreaterThanOrEqual(groups[i].count);
        }
    });

    test('each group includes up to 5 examples', () => {
        const groups = groupFindings(ALL_FINDINGS);
        const bigGroup = groups.find(g => g.count === 10);
        expect(bigGroup.examples.length).toBeLessThanOrEqual(5);
        expect(bigGroup.examples.length).toBeGreaterThan(0);
    });

    test('examples contain page and selector fields', () => {
        const groups = groupFindings(ALL_FINDINGS);
        for (const g of groups) {
            for (const ex of g.examples) {
                expect(ex).toHaveProperty('page');
                expect(ex).toHaveProperty('selector');
            }
        }
    });

    test('empty findings array returns empty groups', () => {
        expect(groupFindings([])).toHaveLength(0);
    });

    test('nth-child variants in selector are normalized and grouped together', () => {
        const findings = [
            {
                page: 'https://example.com/a',
                rule_id: 'color-contrast',
                impact: 'serious',
                message: 'contrast',
                selector: 'li:nth-child(1)',
                html_snippet: '<li>a</li>'
            },
            {
                page: 'https://example.com/b',
                rule_id: 'color-contrast',
                impact: 'serious',
                message: 'contrast',
                selector: 'li:nth-child(2)',
                html_snippet: '<li>a</li>'
            }
        ];
        const groups = groupFindings(findings);
        expect(groups).toHaveLength(1);
        expect(groups[0].count).toBe(2);
    });

    test('group_id is a non-empty hex string', () => {
        const groups = groupFindings(DUPLICATE_FINDINGS);
        expect(/^[0-9a-f]{8}$/.test(groups[0].group_id)).toBe(true);
    });

    test('group_id is stable across repeated calls', () => {
        const groups1 = groupFindings(DUPLICATE_FINDINGS);
        const groups2 = groupFindings(DUPLICATE_FINDINGS);
        expect(groups1[0].group_id).toBe(groups2[0].group_id);
    });
});
