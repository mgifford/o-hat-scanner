# AGENTS.md

This repo is a **CI-focused accessibility scanner** that runs Playwright + axe-core against configured targets and publishes static HTML reports to GitHub Pages.

**Note**: The standalone scanner has been moved to a separate project: [o-hat-standalone](https://github.com/civicactions/o-hat-standalone)

This file tells automated agents (and humans) how to work in this repo without breaking the design.

---

## Non-negotiable constraints

- **CI scanner must run in GitHub Actions** using Playwright and publish reports to GitHub Pages from `/site`.
- **Reports must be WCAG 2.2 AA compliant** - the tool itself must be accessible.
- **All UI changes must have accessibility tests** - contrast, landmarks, headings, etc.
- **Results must follow the shared schema** defined in `scripts/shared-schema.js`.
- **Test-driven development is mandatory** - write tests before implementing changes.

If you change anything that violates these constraints, you broke the repo.

---

## Repo layout (must remain stable)

- `scripts/scan-ci.js`
  CI crawler + axe runner. Produces JSON artifacts under `/site/runs/<runId>/`.

- `scripts/generate-report.js`
  Converts JSON into static HTML and CSV reports under `/site`. Implements professional report template with sidebar, search, severity grouping, and top pages ranking. Must not require a server.

- `scripts/resolve-targets.js`
  Resolves which sites to scan based on `targets.yml` configuration and cron schedules.

- `scripts/targets.js`
  Parses and validates the `targets.yml` configuration file.

- `scripts/archive-old-runs.js`
  Archives old scan runs to keep the repository size manageable.

- `scripts/shared-schema.js`
  Defines the shared schema and validation helpers.

- `targets.yml`
  Configuration file defining sites to scan, schedules, modes (sitemap/crawl/list), and parameters.

- `.github/workflows/a11y-scan.yml`
  Main workflow that runs scans, generates reports, and deploys to GitHub Pages.

- `.github/workflows/quality.yml`
  Runs test suite on PRs and pushes to ensure code quality.

- `tests/`
  Comprehensive test suite including:
  - **Feature tests**: `generate-report.test.js`, `aggregate-report.test.js`, `trends-page.test.js`
  - **Accessibility tests**: `pill-warning-contrast.test.js`, `run-id-contrast.test.js`, `error-message-contrast.test.js`, `html-lang-attribute.test.js`, `link-in-text-block.test.js`, `mini-trend-accessibility.test.js`, `404-landmark.test.js`, `run-page-main-landmark.test.js`
  - **Utility tests**: `scan-ci-utils.test.js`, `fetch-sitemap.test.js`, `sitemap-sampling.test.js`, `extract-links.test.js`, `resolve-sitemap-seed.test.js`, `response-filter.test.js`, `targets.test.js`, `resolve-targets.script.test.js`

---

## Shared result schema (contract)

All scans produce this shape:

```json
{
  "runId": "string",
  "startedAt": "ISO-8601 string",
  "finishedAt": "ISO-8601 string",
  "toolVersion": "string",
  "mode": "ci",
  "config": {
    "baseUrl": "string",
    "maxPages": "number",
    "viewport": "desktop | mobile",
    "colorScheme": "light | dark",
    "browser": "chromium | firefox | webkit"
  },
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
- The schema is validated by `scripts/shared-schema.js`.

---

## Security and safety rules

### Data handling
- Reports may include DOM snippets and selectors. Treat as potentially sensitive.
- Do not add automatic uploading to third-party services.

---

## Crawling rules

### CI mode
- Prefer sitemap discovery when possible.
- Support three modes: `sitemap`, `crawl`, and `list` (configured in `targets.yml`).
- Crawl internal links same-origin up to maxPages.
- Concurrency is allowed but must be bounded (default 2).
- Implement sitemap sampling strategies: `shuffle` (default) and `sequential`.
- Support seed-based deterministic sampling for reproducibility.
- **Language diversity filtering**: Automatically detect and filter multilingual URLs to:
  - Limit each base page to maximum 2 language variants
  - Promote language diversity across the entire scan
  - Avoid scanning same content in 3+ languages
  - Language detection patterns: `/en/`, `/fr/`, `en.example.com`, `/page-en`

Do not implement an uncontrolled crawler that can lock up browsers or CI runners.

---

## Reporting rules
- `/site/index.html` must list runs and link to per-run pages.
- `/site/runs/<runId>/index.html` must implement professional report template with:
  - **Sidebar**: Scan metadata (date, timezone, page count, target URL)
  - **Search bar**: Real-time filtering by issue ID, description, or page URL
  - **Summary cards**: Pages scanned, pages with issues, Must Fix count, Good to Fix count, Manual Review count
  - **WCAG compliance bar chart**: Shows automation coverage percentage
  - **Top pages section**: Top 5 affected pages ranked by violation count
  - **Severity grouping**: Issues organized by impact (critical/moderate/review) with collapsible headers
  - **Per-issue details**: Violation ID, help text, impact level, affected pages, selectors, HTML snippets
  - **CSV export link**: Download button in header for spreadsheet export
  - **Mini trend chart**: Embedded sparkline showing violation trends over time
  - **Print/PDF support**: Print styles and save-as-PDF button
- `/site/runs/<runId>/report.csv` must contain 14 columns matching Oobee schema:
  - customFlowLabel, deviceChosen, scanCompletedAt, severity, issueId, issueDescription, wcagConformance, url, pageTitle, context, howToFix, axeImpact, xpath, learnMore
  - Severity labels: "Must Fix" (critical/serious), "Good to Fix" (moderate/minor), "Manual Review Required" (review)
- `/site/aggregate.csv` tracks all runs with metrics for trending analysis.
- `/site/trends.html` provides interactive multi-series trend visualization with filtering.
- Keep the report static. No backend. No database. All interactivity client-side JavaScript.
- **Accessibility requirement**: All report pages must pass WCAG 2.2 AA, including proper contrast ratios, landmarks, headings, and keyboard navigation.

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
- Concurrency limiting (CI mode)
- Sitemap sampling strategies (shuffle, sequential, seed-based)
- Shared schema validation and backwards compatibility behaviors
- Report aggregation math (pages scanned, pages with violations, total violation instances)
- Error handling per URL (timeouts, navigation errors, missing sitemap)
- Accessibility compliance (contrast ratios, landmarks, semantic HTML)
- Report generation (HTML output, CSV export, trends visualization)

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
- Specific accessibility tests are required for:
  - **Color contrast**: All text and UI elements must meet WCAG AA contrast ratios (tested in `pill-warning-contrast.test.js`, `run-id-contrast.test.js`, `error-message-contrast.test.js`)
  - **Landmarks**: Proper ARIA landmarks for navigation (tested in `404-landmark.test.js`, `run-page-main-landmark.test.js`)
  - **HTML lang attribute**: Language must be specified (tested in `html-lang-attribute.test.js`)
  - **Link accessibility**: Links in text blocks must be distinguishable (tested in `link-in-text-block.test.js`)
  - **Interactive elements**: All charts and interactive components must be accessible (tested in `mini-trend-accessibility.test.js`)
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
- It must not introduce accessibility regressions in the report UI.
- If modifying UI markup or styling, the agent must explicitly verify:
  - keyboard navigation still works,
  - focus is visible,
  - headings remain logical,
  - labels remain correct.
- All accessibility tests must pass before considering work complete.

If those checks were not performed, the work is considered incomplete.

The test suite includes 19 test files covering:
- Feature functionality (report generation, aggregation, trends)
- Accessibility compliance (contrast, landmarks, semantic HTML)
- Utility functions (sitemap parsing, URL filtering, schema validation)
- Integration scenarios (CI scanning, target resolution)

---

## AI disclosure requirement

When an AI agent contributes to this repository, it **must** update the `## 🤖 AI Disclosure` section in `README.md`:

- Add your LLM/tool name and version (if known) to the list if it is not already present.
- Describe specifically what you did (e.g., "Implemented language-diversity filter", "Wrote unit tests for X").
- Do **not** list AI tools that have not actually been used in this project.
- Keep the section accurate and up-to-date — do not overstate or understate AI involvement.

This disclosure covers three dimensions for each tool:
1. **Build-time use**: Was the LLM used to write, refactor, or review code/documentation?
2. **Runtime use**: Is the LLM called or invoked when the scanner runs (scans, reports, CI jobs)?
3. **Browser-based AI**: Does the generated report UI invoke any in-browser AI APIs?

---

## What not to do
- Do not remove GitHub Pages deployment or move reports out of /site.
- Do not weaken or remove testing or accessibility requirements.
- Do not change the shared schema in a backwards-incompatible way.
- Do not add features that require a backend server - reports must remain static.
- Do not remove accessibility tests or introduce WCAG 2.2 AA violations.

---

## Definitions
- **Violation instances**: total count of nodes across all violations.
- **Violation rules**: count of unique violations entries (rule IDs).
- **Same-origin**: protocol, host, and port must match exactly.
