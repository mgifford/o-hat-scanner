# ⚠️ Test Fixtures — Do Not "Fix" Accessibility Issues

## Overview

The files in this directory (`/standalone/`) contain two types of content:

### 1. **The Actual Scanner (MUST be accessible)**
- `a11y-scan.html` — The standalone accessibility scanner UI

**Requirement:** `a11y-scan.html` must meet **WCAG 2.2 Level AA** conformance.
- Semantic HTML, proper labels, keyboard navigation, focus visibility, etc.
- If you find accessibility issues in `a11y-scan.html`, fix them.

### 2. **Test Fixture Pages (MUST stay broken)**
- `page1.html` — Images and color contrast issues
- `page2.html` — Form inputs without labels
- `page3.html` — Icon buttons without accessible names, heading hierarchy issues
- `page4.html` — Missing lang attribute, incorrect ARIA
- `blog/post1.html` — Multiple mixed issue types
- `auth/login.html` — Form accessibility issues
- `demo-bad.html` — General bad practices

**Requirement:** These pages must **intentionally contain accessibility problems** so the scanner can be validated against known issues.

- Do NOT add labels to unlabeled inputs.
- Do NOT fix color contrast issues.
- Do NOT add missing alt text to images.
- Do NOT improve heading hierarchy.
- Do NOT remove invalid ARIA attributes.

If these pages are "fixed," the test suite cannot validate that the scanner correctly identifies violations.

## For Future Agents

If you are asked to "improve accessibility" or "fix accessibility problems":
1. **Check which file** you are modifying.
2. **If it's `a11y-scan.html`**: Yes, improve accessibility.
3. **If it's `page*.html`, `demo-bad.html`, `blog/post*.html`, or `auth/*.html`**: Do NOT fix these. They are intentional test fixtures.

Refer to the parent [../AGENTS.md](../AGENTS.md) for overall project constraints.

## Test Validation

These fixture pages are used by:
- `tests/standalone.test.js` — Validates the scanner against known issues
- Manual testing with `standalone/a11y-scan.html?token=A11Y-SECRET`

Keep them broken. That's the point.
