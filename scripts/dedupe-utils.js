/**
 * Pure utility functions for finding deduplication.
 * Used by server-side unit tests (via import) and inlined into the generated report HTML.
 *
 * IMPORTANT: This file must NOT use template literals (backtick characters).
 * It is read at build time by `getDedupeUtilsInline()` in generate-report.js and
 * embedded verbatim inside a Node.js template literal. Any backtick character would
 * terminate that outer template literal and cause a build-time syntax error.
 * Use regular string literals ('single' or "double") throughout this file.
 */

/**
 * Normalize a CSS selector to remove fragile parts.
 * - Removes :nth-child(n) and :nth-of-type(n)
 * - Replaces long numeric suffix IDs (#foo-12345) with #foo-*
 * - Collapses whitespace
 */
function normalizeSelector(selector) {
    if (!selector) return '';
    return String(selector)
        .replace(/:nth-child\(\d+\)/g, '')
        .replace(/:nth-of-type\(\d+\)/g, '')
        .replace(/#([a-zA-Z][a-zA-Z0-9_-]*)-\d{4,}/g, '#$1-*')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Create a stable fingerprint from a finding message.
 * - Lowercases the string
 * - Replaces URLs with *
 * - Replaces numeric sequences with *
 * - Trims whitespace
 */
function fingerprintMessage(msg) {
    if (!msg) return '';
    return String(msg)
        .toLowerCase()
        .replace(/https?:\/\/[^\s]+/g, '*')
        .replace(/\b\d+\b/g, '*')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Create a stable fingerprint for a finding node.
 * Uses normalized selector + first 80 chars of html_snippet.
 */
function nodeFingerprint(finding) {
    var sel = normalizeSelector(finding.selector || '');
    var snippet = String(finding.html_snippet || '').substring(0, 80);
    return sel + '||' + snippet;
}

/**
 * Build a stable signature string for a finding.
 * Signature = rule_id|impact|nodeFingerprint|messageFingerprint
 */
function buildSignature(finding) {
    var impact = String(finding.impact || '').toLowerCase();
    var fp = nodeFingerprint(finding);
    var msgFp = fingerprintMessage(finding.message || '');
    return String(finding.rule_id || '') + '|' + impact + '|' + fp + '|' + msgFp;
}

/**
 * Fast djb2-style hash producing an 8-character hex string.
 * Stable across runs for the same input.
 */
function simpleHash(str) {
    var h = 5381;
    for (var i = 0; i < str.length; i++) {
        h = ((h << 5) + h) ^ str.charCodeAt(i);
        h = h >>> 0;
    }
    return h.toString(16).padStart(8, '0');
}

/**
 * Compute a component hint from example selectors.
 * Returns the most common CSS class that appears in more than one example, or null.
 */
function computeComponentHint(examples) {
    if (!examples || examples.length < 2) return null;
    var classCount = Object.create(null);
    for (var i = 0; i < examples.length; i++) {
        var matches = (examples[i].selector || '').match(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g) || [];
        for (var j = 0; j < matches.length; j++) {
            var cls = matches[j];
            classCount[cls] = (classCount[cls] || 0) + 1;
        }
    }
    var best = null;
    var bestCount = 1;
    var keys = Object.keys(classCount);
    for (var k = 0; k < keys.length; k++) {
        if (classCount[keys[k]] > bestCount) {
            bestCount = classCount[keys[k]];
            best = keys[k];
        }
    }
    return best;
}

/**
 * Group an array of normalized findings by signature.
 * Returns DedupedGroup[] sorted by count descending.
 * Each DedupedGroup: { group_id, rule_id, impact, message, count, pages_affected, examples, component_hint }
 */
function groupFindings(findings) {
    var map = Object.create(null);
    for (var i = 0; i < findings.length; i++) {
        var f = findings[i];
        var sig = buildSignature(f);
        if (!map[sig]) {
            map[sig] = {
                group_id: simpleHash(sig),
                rule_id: f.rule_id || '',
                impact: f.impact || null,
                message: f.message || '',
                count: 0,
                examples: [],
                _pages: Object.create(null)
            };
        }
        var g = map[sig];
        g.count++;
        g._pages[f.page || ''] = true;
        if (g.examples.length < 5) {
            g.examples.push({
                page: f.page || '',
                selector: f.selector || '',
                html_snippet: String(f.html_snippet || '').substring(0, 150)
            });
        }
    }
    var groups = [];
    var sigs = Object.keys(map);
    for (var s = 0; s < sigs.length; s++) {
        var g2 = map[sigs[s]];
        var pagesAffected = Object.keys(g2._pages).length;
        groups.push({
            group_id: g2.group_id,
            rule_id: g2.rule_id,
            impact: g2.impact,
            message: g2.message,
            count: g2.count,
            pages_affected: pagesAffected,
            examples: g2.examples,
            component_hint: computeComponentHint(g2.examples)
        });
    }
    groups.sort(function(a, b) { return b.count - a.count; });
    return groups;
}

export { normalizeSelector, fingerprintMessage, nodeFingerprint, buildSignature, simpleHash, computeComponentHint, groupFindings };
