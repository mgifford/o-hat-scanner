# agents.md

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
  Converts JSON into static HTML under `/site`. Must not require a server.

- `scripts/shared-schema.js`  
  Defines the shared schema and validation helpers. Both modes must match it.

- `standalone/a11y-scan.html`  
  Single-file scanner UI that crawls same-origin pages via sitemap or list.

- `assets/axe.min.js`  
  Vendored axe build for standalone scanning and (optionally) for CI injection.

- `.github/workflows/a11y-scan.yml`  
  Runs `scan-ci.js` and `generate-report.js`, then deploys `/site` to Pages.

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
      "error": "optional string"
    }
  }
}


Rules:
	•	resultsByUrl[url].violations must always exist (empty array allowed).
	•	Errors must be captured per URL, not crash the entire run.
	•	Keep axe’s object structure intact. Do not “simplify” it in a lossy way.
	•	Add fields only in a backwards-compatible way.

⸻

Security and safety rules

Standalone scanner gating
	•	The standalone scanner MUST have a gate (token query param or stronger).
	•	Do not remove the gate.
	•	README must warn: do not deploy publicly, prefer staging or auth.

Data handling
	•	Reports may include DOM snippets and selectors. Treat as potentially sensitive.
	•	Do not add automatic uploading to third-party services.

⸻

Crawling rules

CI mode
	•	Prefer sitemap discovery when possible.
	•	Otherwise crawl internal links same-origin up to maxPages.
	•	Concurrency is allowed but must be bounded (default 2).

Standalone mode
	•	Default is sequential scanning (no parallel iframes).
	•	Source of URLs is sitemap.xml by default, plus optional filtering.
	•	Provide maxPages, timeout, and delay controls.

Do not implement an uncontrolled crawler that can lock up browsers or CI runners.

⸻

Reporting rules
	•	/site/index.html must list runs and link to per-run pages.
	•	/site/runs/<runId>/index.html must show:
	•	pages scanned
	•	pages with violations
	•	total violation instances
	•	table by URL
	•	expandable per-rule details with node targets and snippets where available
	•	Keep the report static. No backend. No database.

⸻

Test-driven development and unit testing

This project uses test-driven development (TDD) as the default workflow.
Unit testing is mandatory.

TDD rules
	•	Write a failing test before implementing a fix or feature.
	•	Every PR must include tests covering new or changed behavior.
	•	If a change cannot be unit tested, document why and what alternative validation was used.

Required unit test coverage

Unit tests must exist for:
	•	URL normalization and validation
	•	Sitemap parsing (urlset and sitemapindex)
	•	Filtering logic (prefix, exclude substrings, maxPages)
	•	Same-origin enforcement
	•	Concurrency limiting (CI mode)
	•	Sequential execution guarantees (standalone logic)
	•	Shared schema validation and backwards compatibility
	•	Aggregation math (counts and summaries)
	•	Per-URL error handling (timeouts, navigation failures)

Test boundaries
	•	Prefer pure-function tests for parsing, filtering, aggregation, and schema logic.
	•	Use Playwright-based integration tests sparingly and deterministically.
	•	Do not commit flaky or timing-sensitive tests.

Definition of done

A change is complete only when:
	•	All tests pass locally and in CI
	•	Coverage does not regress without justification
	•	New code paths are exercised by tests

⸻

Accessibility target: WCAG 2.2 AA

The project itself must meet WCAG 2.2 Level AA.

Scope
	•	/site generated report pages
	•	standalone/a11y-scan.html UI

Requirements
	•	Full keyboard operability
	•	Visible focus indicators
	•	Logical heading structure
	•	Accessible form labels and controls
	•	Color contrast meeting AA
	•	Clear error and status messaging
	•	No keyboard traps
	•	Responsive layout and reflow support

Dynamic updates (scan progress, completion) must be announced via appropriate aria-live regions.

Important limitation
	•	Automated scan results do not equal WCAG 2.2 AA compliance.
	•	Do not claim or imply certification or full conformance of scanned sites.

Accessibility verification
	•	Automated checks (axe or equivalent) are required but insufficient alone.
	•	Manual release checks must include:
	•	Keyboard-only navigation
	•	Screen reader spot-check of headings, tables, expandable sections, and progress updates
	•	Visual contrast review of primary UI elements

UI implementation rules
	•	Prefer native HTML elements over custom widgets.
	•	Do not introduce inaccessible custom controls.
	•	Any UI change must be reviewed for accessibility impact.

⸻

Agent expectations

When making changes, agents must:
	1.	Identify which mode is affected (CI, standalone, or both).
	2.	Add or update unit tests first (TDD).
	3.	Preserve the shared schema contract.
	4.	Avoid introducing accessibility regressions.
	5.	Update documentation if behavior changes.

If these steps are not followed, the work is incomplete.

⸻

What not to do
	•	Do not add cross-origin scanning claims or code paths in standalone mode.
	•	Do not load axe from a CDN in standalone mode.
	•	Do not split the standalone scanner into multiple files.
	•	Do not remove GitHub Pages deployment or move reports out of /site.
	•	Do not weaken or remove testing or accessibility requirements.

⸻

Definitions
	•	Violation instances: total count of nodes across all violations.
	•	Violation rules: count of unique violations entries (rule IDs).
	•	Same-origin: protocol, host, and port must match exactly.

End of file.