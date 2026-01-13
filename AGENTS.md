# AGENTS.md

This repo supports two accessibility scanning modes in one codebase:

1. **CI scanner**: GitHub Actions runs Playwright + axe-core against a list of URLs/domains, then publishes a static HTML report to GitHub Pages.
2. **Standalone scanner**: a single HTML file you can drop into a site (same-origin) that crawls via `sitemap.xml`, scans pages in hidden iframes with axe, and shows a report in the browser.

This file tells automated agents (and humans) how to work in this repo without breaking the two-mode design.

---

## Non-negotiable constraints

- **Standalone mode is same-origin only.** Do not claim it can scan other domains. Browser security prevents DOM access cross-origin.
- **Standalone scanner must remain a single HTML file** located at `standalone/a11y-scan.html`.
- **Standalone scanner must vendor axe** from `assets/axe.min.js`. No CDN.
- **CI scanner must run in GitHub Actions** using Playwright and publish reports to GitHub Pages from `/site`.
- **Both modes must emit the same result schema**, with `mode: "ci"` or `mode: "standalone"`.

If you change anything that violates these constraints, you broke the repo.

---

## Repo layout (must remain stable)

- `scripts/scan-ci.js`
  CI crawler + axe runner. Produces JSON artifacts under `/site/runs/<runId>/`.

- `scripts/generate-report.js`
  Converts JSON into static HTML and CSV reports under `/site`. Implements Oobee-style professional report template with sidebar, search, severity grouping, and top pages ranking. Must not require a server.

- `scripts/scan-local.js`
  Local testing utility. Scans test pages via Playwright against localhost:8082, generates results compatible with report generator.

- `scripts/shared-schema.js`
  Defines the shared schema and validation helpers. Both modes must match it.

- `standalone/a11y-scan.html`
  Single-file scanner UI that crawls same-origin pages via sitemap or list. Includes JSON and CSV export with Oobee-compatible headers.

- `standalone/page*.html`, `standalone/blog/`, `standalone/auth/`
  Test pages with intentional accessibility issues for validation and testing.

- `assets/axe.min.js`
  Vendored axe build for standalone scanning and (optionally) for CI injection.

- `.github/workflows/a11y-scan.yml`
  Runs `scan-ci.js` and `generate-report.js`, then deploys `/site` to Pages.

- `tests/generate-report.test.js`
  Test suite validating report generation with Oobee template features.

---

## Shared result schema (contract)

All scans produce this shape:

```json
{
  "runId": "string",
  "startedAt": "ISO-8601 string",
  "finishedAt": "ISO-8601 string",
  "toolVersion": "string",
  "mode": "ci | standalone",
  "config": { "any": "object" },
  "targets": ["urlOrDomain", "..."],
  "resultsByUrl": {
    "https://example.com/page": {
      "violations": [ "axe violation objects" ],
      "passes": [ "optional" ],
      "incomplete": [ "optional" ],
      "title": "optional string",
      "error": "optional string"
    }
  }
}
```

Rules:
- `resultsByUrl[url].violations` must always exist (empty array allowed).
- Errors must be captured per URL, not crash the entire run.
- Keep axe’s object structure intact. Do not “simplify” it in a lossy way.
- Add fields only in a backwards-compatible way.

---

## Security and safety rules

### Standalone scanner gating
- The standalone scanner MUST have a gate (token query param or stronger).
- Do not remove the gate.
- README must warn: do not deploy publicly, prefer staging or auth.

### Data handling
- Reports may include DOM snippets and selectors. Treat as potentially sensitive.
- Do not add automatic uploading to third-party services.

---

## Crawling rules

### CI mode
- Prefer sitemap discovery when possible.
- Otherwise crawl internal links same-origin up to maxPages.
- Concurrency is allowed but must be bounded (default 2).

### Standalone mode
- Default is sequential scanning (no parallel iframes).
- Source of URLs is sitemap.xml by default, plus optional filtering.
- Provide maxPages, timeout, and delay controls.

Do not implement an uncontrolled crawler that can lock up browsers or CI runners.

---

## Reporting rules
- `/site/index.html` must list runs and link to per-run pages.
- `/site/runs/<runId>/index.html` must implement Oobee-style professional template with:
  - **Sidebar**: Scan metadata (date, timezone, page count, target URL)
  - **Search bar**: Real-time filtering by issue ID, description, or page URL
  - **Summary cards**: Pages scanned, pages with issues, Must Fix count, Good to Fix count, Manual Review count
  - **WCAG compliance bar chart**: Shows automation coverage percentage
  - **Top pages section**: Top 5 affected pages ranked by violation count
  - **Severity grouping**: Issues organized by impact (critical/moderate/review) with collapsible headers
  - **Per-issue details**: Violation ID, help text, impact level, affected pages, selectors, HTML snippets
  - **CSV export link**: Download button in header for spreadsheet export
- `/site/runs/<runId>/report.csv` must contain 14 columns matching Oobee schema:
  - customFlowLabel, deviceChosen, scanCompletedAt, severity, issueId, issueDescription, wcagConformance, url, pageTitle, context, howToFix, axeImpact, xpath, learnMore
  - Severity labels: "Must Fix" (critical), "Good to Fix" (moderate), "Manual Review Required" (minor/review)
- Keep the report static. No backend. No database. All interactivity client-side JavaScript.

---

## Test-driven development and unit testing

This project is developed using **test-driven development (TDD)** as the default workflow. Unit testing is not optional.

### TDD rules
- For any behavior change or bug fix, write a failing test first, then implement the change, then refactor.
- Every PR must include tests that cover:
  - The bug being fixed (regression test), or
  - The new feature behavior (positive and negative cases), or
  - Both.
- If a change cannot be meaningfully tested (rare), the PR must explicitly document why and what was done instead (for example, narrow integration test, contract test, or a manual verification script).

### Unit testing scope (minimum)
Unit tests must exist for:
- URL normalization and validation
- Sitemap parsing (urlset and sitemapindex)
- Filtering logic (prefix, exclude substrings, maxPages)
- Crawl boundary enforcement (same-origin)
- Concurrency limiting (CI mode) and sequential enforcement (standalone mode logic if extracted)
- Shared schema validation and backwards compatibility behaviors
- Report aggregation math (pages scanned, pages with violations, total violation instances)
- Error handling per URL (timeouts, navigation errors, missing sitemap)

### Test strategy boundaries
- Prefer **pure function** units for most logic (parsing, filtering, aggregation, schema validation).
- Keep Playwright-dependent tests to a small number of **integration tests** using:
  - A tiny local fixture site (static HTML pages) served during tests, or
  - A mocked browser interface if you have separated concerns cleanly.
- Do not add flaky tests. If a test is nondeterministic, it must be redesigned or quarantined with clear rationale.

### Definition of done for changes
A change is not complete unless:
- All unit tests pass locally and in CI.
- Test coverage does not decrease without justification.
- New code paths are exercised by tests.

---

## Accessibility target: WCAG 2.2 AA

The project itself (repo-generated reports and the standalone scanner UI) must meet **WCAG 2.2 Level AA**.

### What this means here
- The generated report pages in `/site` must be WCAG 2.2 AA conformant.
- `standalone/a11y-scan.html` must be WCAG 2.2 AA conformant.
- This requirement applies to:
  - Keyboard navigation
  - Focus visibility and focus order
  - Labels and accessible names
  - Color contrast (AA)
  - Headings and structure
  - Error identification and messaging
  - Status announcements (progress updates should be announced appropriately)
  - Non-text content handling (icons, controls)
  - Reflow and responsive layout
  - No keyboard traps

### Important limitation (do not misrepresent)
- Axe results for scanned sites do not equal WCAG 2.2 AA compliance. Automated testing is partial coverage only.
- Do not claim the scanners “certify” compliance.

### Required accessibility checks
- Add automated checks for the scanner UI and report UI:
  - Axe-based checks are allowed and encouraged, but must not be the only gate.
- Add at least one manual verification checklist item in the README for releases:
  - Keyboard-only smoke test
  - Screen reader spot-check (at minimum: headings, table navigation, expandable details, progress updates)
  - Contrast check for key UI elements

### UI implementation requirements
- No inaccessible custom controls. Use native elements where possible:
  - `<button>`, `<details>/<summary>`, `<table>` with proper headers, `<label>` + form controls.
- Any dynamic progress updates must be surfaced to assistive tech:
  - Use an `aria-live` region for scan progress and completion status.

---

## Agent expectations for tests and accessibility

When an agent changes code:
- It must add or update unit tests first (TDD).
- It must not introduce accessibility regressions in the report UI or standalone UI.
- If modifying UI markup or styling, the agent must explicitly verify:
  - keyboard navigation still works,
  - focus is visible,
  - headings remain logical,
  - labels remain correct.

If those checks were not performed, the work is considered incomplete.

---

## What not to do
- Do not add cross-origin scanning claims or code paths in standalone mode.
- Do not load axe from a CDN in standalone mode.
- Do not split the standalone scanner into multiple files.
- Do not remove GitHub Pages deployment or move reports out of /site.
- Do not weaken or remove testing or accessibility requirements.

---

## Definitions
- **Violation instances**: total count of nodes across all violations.
- **Violation rules**: count of unique violations entries (rule IDs).
- **Same-origin**: protocol, host, and port must match exactly.
