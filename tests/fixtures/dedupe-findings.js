/**
 * Test fixtures: 30 findings for dedupe unit tests.
 *
 * - 10 obvious duplicates  → same signature → 1 DedupedGroup (count=10)
 * - 10 similar findings    → distinct signatures (different selector/snippet)
 *                            → 10 groups (AI layer could merge, Phase A keeps separate)
 * - 10 fully distinct      → different rule_ids/impacts → 10 groups
 *
 * Total expected groups after Phase A: 21
 */

// 10 exact duplicates – same selector, html_snippet, rule, impact, and message
// All findings differ only in the page URL → same signature → 1 group with count=10
export const DUPLICATE_FINDINGS = Array.from({ length: 10 }, function(_, i) {
    return {
        page: 'https://example.com/page' + (i + 1),
        rule_id: 'color-contrast',
        impact: 'serious',
        message: 'Elements must have sufficient color contrast',
        selector: '.text-muted',
        html_snippet: '<p class="text-muted">Example content</p>'
    };
});

// 10 similar findings – same rule and impact but different selectors and html snippets
// Each has a unique selector (section-header-N) so they produce distinct signatures.
// At AI layer, same root cause could merge them; Phase A keeps them separate.
export const SIMILAR_FINDINGS = Array.from({ length: 10 }, function(_, i) {
    return {
        page: 'https://example.com/article-' + (i + 1),
        rule_id: 'heading-order',
        impact: 'moderate',
        message: 'Heading levels should only increase by one, increment by one at a time',
        selector: 'h3.section-header-' + (i + 1),
        html_snippet: '<h3 class="section-header-' + (i + 1) + '">Section ' + (i + 1) + '</h3>'
    };
});

// 10 fully distinct findings – each has a unique rule_id so they cannot share a signature
export const DISTINCT_FINDINGS = [
    {
        page: 'https://example.com/home',
        rule_id: 'image-alt',
        impact: 'critical',
        message: 'Images must have alternate text',
        selector: 'img.hero-image',
        html_snippet: '<img class="hero-image" src="/hero.jpg">'
    },
    {
        page: 'https://example.com/home',
        rule_id: 'button-name',
        impact: 'critical',
        message: 'Buttons must have an accessible name',
        selector: 'button#menu-toggle',
        html_snippet: '<button id="menu-toggle"></button>'
    },
    {
        page: 'https://example.com/contact',
        rule_id: 'label',
        impact: 'critical',
        message: 'Form elements must have labels',
        selector: 'input[name="email"]',
        html_snippet: '<input name="email" type="email">'
    },
    {
        page: 'https://example.com/contact',
        rule_id: 'aria-required-attr',
        impact: 'critical',
        message: 'Required ARIA attributes must be provided',
        selector: '[role="checkbox"]',
        html_snippet: '<div role="checkbox"></div>'
    },
    {
        page: 'https://example.com/about',
        rule_id: 'document-title',
        impact: 'serious',
        message: 'Documents must have title element to aid in navigation',
        selector: 'html',
        html_snippet: '<html lang="en">'
    },
    {
        page: 'https://example.com/about',
        rule_id: 'link-name',
        impact: 'serious',
        message: 'Links must have discernible text',
        selector: 'a.social-link',
        html_snippet: '<a class="social-link" href="/twitter"></a>'
    },
    {
        page: 'https://example.com/products',
        rule_id: 'landmark-one-main',
        impact: 'moderate',
        message: 'Document should have one main landmark',
        selector: 'body',
        html_snippet: '<body>'
    },
    {
        page: 'https://example.com/products',
        rule_id: 'list',
        impact: 'minor',
        message: 'List items must be contained in a ul, ol or role list parent element',
        selector: 'li.nav-item',
        html_snippet: '<li class="nav-item">Home</li>'
    },
    {
        page: 'https://example.com/blog',
        rule_id: 'frame-title',
        impact: 'serious',
        message: 'Frames must have title attribute',
        selector: 'iframe.embed',
        html_snippet: '<iframe class="embed" src="/embed"></iframe>'
    },
    {
        page: 'https://example.com/blog',
        rule_id: 'scrollable-region-focusable',
        impact: 'moderate',
        message: 'Scrollable region must have keyboard access',
        selector: 'div.overflow-scroll',
        html_snippet: '<div class="overflow-scroll">content</div>'
    }
];

export const ALL_FINDINGS = [...DUPLICATE_FINDINGS, ...SIMILAR_FINDINGS, ...DISTINCT_FINDINGS];
