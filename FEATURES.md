# O-Hat Scanner — Feature Reference

This document catalogs every feature of O-Hat Scanner so it can be compared with other accessibility scanning tools. Features are organized by category.

---

## Table of Contents

1. [Scanning Engine](#1-scanning-engine)
2. [URL Discovery & Crawling](#2-url-discovery--crawling)
3. [Language Diversity Filtering](#3-language-diversity-filtering)
4. [Scheduling & CI/CD](#4-scheduling--cicd)
5. [Report Output](#5-report-output)
6. [Report UI & Interactivity](#6-report-ui--interactivity)
7. [Trend & Aggregate Reporting](#7-trend--aggregate-reporting)
8. [Data Export](#8-data-export)
9. [Accessibility of the Tool Itself](#9-accessibility-of-the-tool-itself)
10. [Configuration Reference](#10-configuration-reference)
11. [Security](#11-security)
12. [Architecture & Deployment](#12-architecture--deployment)
13. [Developer Experience](#13-developer-experience)
14. [Comparison Matrix](#14-comparison-matrix)

---

## 1. Scanning Engine

| Feature | Detail |
|---|---|
| **Axe-core version** | 4.10+ (via `@axe-core/playwright`) |
| **Browser automation** | Playwright |
| **Supported browsers** | Chromium (default), Firefox, WebKit |
| **Viewport profiles** | Desktop (default), Mobile |
| **Colour schemes** | Light (default), Dark |
| **Multi-variant runs** | `both` setting creates separate scan runs per viewport and/or colour scheme (up to 4 simultaneous variants) |
| **Concurrency** | Configurable parallel tabs (default 2, bounded to prevent CI lock-up) |
| **Per-page timeout** | Configurable (default 30 s) |
| **Max pages per run** | Configurable 1–200 (default 50; clamped at 200) |
| **Non-HTML skipping** | Automatically skips `.pdf`, `.doc`, `.xls`, `.ppt`, `.zip`, and other binary extensions (configurable) |
| **Error isolation** | Errors are captured per URL — a failed page never crashes the entire run |
| **Custom user-agent** | Configurable via `INPUT_USER_AGENT` |
| **WCAG target** | WCAG 2.2 AA (axe wcag2a + wcag2aa rule sets) |

---

## 2. URL Discovery & Crawling

### Scan Modes

| Mode | Description |
|---|---|
| **`sitemap`** | Fetches `sitemap.xml` (including sitemapindex recursion), samples up to `maxPages` URLs, then scans. Falls back to crawl if sitemap is missing or empty (configurable). |
| **`crawl`** | Crawls same-origin links starting from the base URL, bounded by `maxPages`. |
| **`list`** | Scans an explicit list of URLs provided in `targets.yml` or via `INPUT_URLS`. |
| **`discover`** | Quarterly baseline discovery — builds a curated canonical URL list via SERP + nav crawl, then runs a `list`-mode scan on the result. |

### Sitemap Handling

- Recursive `sitemapindex` support (nested sitemaps)
- Sampling strategies: `shuffle` (default, randomized) or `sequential` (first N entries)
- Deterministic sampling with an optional seed (reproducible runs)
- Auto-fallback to crawl when sitemap is absent or empty

### Discovery Mode (`discover`)

- Bing Web Search API integration (optional; requires `BING_API_KEY` secret)
- Nav-only fallback when no API key is configured
- Homepage header/footer/nav crawl + one-hop expansion
- Deduplication: URL normalization, redirect resolution (up to 10 hops), near-duplicate fingerprinting (SHA-256)
- Filters: HTTP errors, non-HTML content, error-page detection (multi-language keywords)
- Required-page guarantee: accessibility statement, privacy, search, terms, cookies, security, homepage are always included when found
- SERP scoring: position + nav prominence + policy-page bonus
- Configurable per-target custom discovery queries (`discoveryQueries` in `targets.yml`)
- Default **Tier 1 queries** optimized for government sites: `site:{host}`, `accessibility`, `services`, `forms`, `help`, `privacy`, `contact`
- Custom **Tier 2 queries** for domain-specific discovery (benefits, health, licensing, etc.)
- Output: `site/targets/<siteKey>.urls.json` (rich metadata) + `.urls.txt` (plain URL list)
- Body-fetch cap (~300 pages) prevents runaway discovery

---

## 3. Language Diversity Filtering

Automatically applied after sitemap/crawl discovery, before scanning:

- Detects language codes in URLs: path segments (`/en/`, `/fr/`), subdomains (`en.example.com`), suffixes (`/page-en`)
- Groups pages by base path (strips language component)
- Limits each base page to **maximum 2 language variants**
- Promotes language diversity across the entire scan budget
- Prevents scanning the same content in 3+ languages
- No configuration required; always active

---

## 4. Scheduling & CI/CD

### GitHub Actions Integration

- **Automated scheduling** via `targets.yml` cron expressions (UTC)
- **Hourly night-window runner**: workflow fires 4 am–10 am UTC (11 pm–5 am ET) hourly; only sites "due" for that tick actually run
- **Quarterly discovery cron**: first day of each quarter at 5 am UTC
- **Manual dispatch** (`workflow_dispatch`) with inputs:
  - `site` — run a single named target
  - `override_label` — rename the run folder/report
  - `viewport_profile` / `color_scheme` — `desktop`, `mobile`, or `both`; `light`, `dark`, or `both`
  - `max_pages` — per-dispatch page cap
  - `browser` — `chromium`, `firefox`, `webkit`, or `all`
  - `sampling_seed_strategy` — `fixed` or `random`
  - `ignore_schedule` — bypass cron windows and run all configured targets immediately
  - `reset_history` — clear GitHub Pages history and start fresh
  - `simulated_time` — simulate a specific date/time for schedule testing
- **Push trigger**: workflow also runs when `targets.txt`, `scripts/**`, or `.github/workflows/**` change
- **Concurrency guard**: single `pages-<ref>` group prevents overlapping deployments
- Skips browser install entirely when no sites are due (saves CI time/cost)
- Self-scan: the published GitHub Pages site is scanned monthly for its own accessibility

### Quality Workflow

- Separate `quality.yml` workflow runs the full Jest test suite on PRs and pushes

---

## 5. Report Output

### Per-Run Files

| File | Description |
|---|---|
| `site/runs/<runId>/index.html` | Interactive HTML report (see §6) |
| `site/runs/<runId>/report.csv` | CSV export (14-column Oobee-compatible schema) |
| `site/runs/<runId>/results.json` | Raw axe-core results (full fidelity) |
| `site/runs/<runId>/summary.json` | Scan metadata summary |

### Aggregate Files

| File | Description |
|---|---|
| `site/index.html` | Listing of all runs with links to per-run reports |
| `site/aggregate.csv` | Cross-run metrics for trend analysis |
| `site/trends.html` | Interactive multi-series trend visualization |
| `site/targets/<siteKey>.urls.json` | Discovery metadata (discover-mode targets) |
| `site/targets/<siteKey>.urls.txt` | Plain URL list (discover-mode targets) |

### Run ID Convention

Run folders are named `<domainSlug>--<ISO-timestamp>--<label>` for human-readable sorting. Up to 3 runs per domain are shown on the index; older runs are archived.

---

## 6. Report UI & Interactivity

All interactivity is **client-side JavaScript** — no backend, no database.

| Feature | Detail |
|---|---|
| **Layout** | 2-column: sidebar (scan metadata) + main content |
| **Sidebar metadata** | Date/time + timezone, page count, target URL, viewport, colour scheme, browser, mode, max pages, sample strategy + seed |
| **Search / filter** | Real-time text filter across issue IDs, descriptions, and page URLs |
| **Summary dashboard** | Cards: pages scanned, pages with issues, Must Fix count, Good to Fix count, Manual Review count |
| **WCAG compliance bar chart** | Automation-coverage percentage visualization |
| **Top pages ranking** | Top 5 most-affected pages by violation count |
| **Severity grouping** | Issues organized by impact: critical → moderate → review |
| **Collapsible sections** | Click severity headers to expand/collapse |
| **Per-issue detail** | Violation ID, help text, impact level, WCAG SC numbers, affected page count, CSS selector, HTML snippet, failure summary, learn-more link |
| **Unique hash per instance** | MD5 of `url + selector` for stable issue tracking across runs |
| **Mini trend sparkline** | Embedded sparkline showing violation trends over time for the same domain |
| **Light/dark mode toggle** | CSS custom properties; persisted across page loads |
| **Print / save-as-PDF** | Print styles + in-page Save as PDF button |
| **Copy failure details** | Per-violation button copies pre-formatted bug report to clipboard |
| **Keyboard navigation** | Full keyboard access; visible focus indicators |
| **No external dependencies** | Custom CSS only (~50 KB); no CDN calls |

---

## 7. Trend & Aggregate Reporting

- `site/aggregate.csv` records every run: run ID, domain, date, pages scanned, pages with violations, total violation instances, unique rule IDs
- `site/trends.html` provides an interactive multi-series line chart with per-domain filtering
- Mini trend sparklines are embedded in each per-run report for at-a-glance history
- Domain-grouped index (max 3 active runs shown per domain; older runs archived)

---

## 8. Data Export

| Format | Scope | Detail |
|---|---|---|
| **CSV (per-run)** | Per scan run | 14-column Oobee-compatible schema (see §8.1) |
| **CSV (aggregate)** | All runs | Cross-run metrics |
| **JSON (raw)** | Per scan run | Full axe-core output, unmodified |
| **Print to PDF** | Per scan run | Via browser print dialog |

### 8.1 CSV Schema (14 columns, Oobee-compatible)

| Column | Description |
|---|---|
| `customFlowLabel` | Scan label |
| `deviceChosen` | `Desktop` or `Mobile` |
| `scanCompletedAt` | ISO-8601 timestamp |
| `severity` | Must Fix / Good to Fix / Manual Review Required |
| `issueId` | Axe-core rule ID |
| `issueDescription` | Short rule description |
| `wcagConformance` | WCAG SC number(s) (e.g. `1.1.1, 4.1.2`) |
| `url` | Full URL of the affected page |
| `pageTitle` | Page `<title>` |
| `context` | Failing HTML snippet |
| `howToFix` | Remediation guidance |
| `axeImpact` | Raw axe impact level |
| `xpath` | CSS selector(s) for failing element |
| `learnMore` | Link to axe rule documentation |

### 8.2 Severity Mapping

| Axe impact | Severity label |
|---|---|
| `critical` / `serious` | **Must Fix** |
| `moderate` / `minor` | **Good to Fix** |
| `review` / `incomplete` | **Manual Review Required** |

---

## 9. Accessibility of the Tool Itself

O-Hat Scanner holds generated reports to **WCAG 2.2 Level AA**.

| Requirement | Implementation |
|---|---|
| Colour contrast (AA) | Verified by automated tests (`pill-warning-contrast`, `run-id-contrast`, `error-message-contrast`, `status-fail-contrast`) |
| Landmarks | `<main>`, `<nav>`, `<header>`, `<footer>` on every report page (tested in `404-landmark`, `run-page-main-landmark`) |
| HTML `lang` attribute | Present on all generated pages (tested in `html-lang-attribute`) |
| Heading order | Logical hierarchy, no skipped levels (tested in `heading-order`) |
| Link accessibility | Links in text blocks are distinguishable (tested in `link-in-text-block`) |
| Interactive elements | Charts and interactive components are keyboard-accessible (tested in `mini-trend-accessibility`) |
| Logo / navigation links | Accessible names verified (`logo-link-accessibility`) |
| Light/dark mode | Contrast verified in both schemes (`light-dark-mode`) |
| Focus indicators | Visible focus for all interactive elements |
| Semantic HTML | Native elements (`<button>`, `<details>/<summary>`, `<table>` with headers) |

---

## 10. Configuration Reference

### `targets.yml` per-site fields

| Field | Default | Description |
|---|---|---|
| `name` | *(required)* | Human-readable site name |
| `baseUrl` | *(required)* | Origin URL for sitemap/crawl/discover modes |
| `mode` | `sitemap` | `sitemap` \| `crawl` \| `list` \| `discover` |
| `maxPages` | `50` | Max pages to scan (discover: max discovered URLs) |
| `schedule` | *(none)* | Array of UTC cron expressions |
| `label` | *(none)* | Appended to run folder name (`<timestamp>--<label>`) |
| `urls` | *(none)* | Explicit URL list for `mode: list` |
| `discoveryQueries` | *(Tier 1 defaults)* | Custom SERP queries for `mode: discover` |
| `notes` | *(none)* | Human-readable notes |

### Environment Variables (CI scanner)

| Variable | Default | Description |
|---|---|---|
| `INPUT_URLS` | *(none)* | Newline-separated URL list |
| `INPUT_BASE_URL` | *(none)* | Base origin for sitemap/crawl/discover |
| `INPUT_MODE` | `sitemap` | Scan mode |
| `INPUT_LABEL` | *(none)* | Run label |
| `INPUT_MAX_PAGES` | `50` | Max pages (capped at 200) |
| `INPUT_CONCURRENCY` | `2` | Parallel browser tabs |
| `INPUT_TIMEOUT_MS` | `30000` | Per-page timeout |
| `INPUT_VIEWPORT_PROFILE` | `desktop` | `desktop` \| `mobile` |
| `INPUT_COLOR_SCHEME` | `light` | `light` \| `dark` |
| `INPUT_BROWSER` | `chromium` | `chromium` \| `firefox` \| `webkit` |
| `INPUT_SITEMAP_SAMPLE_STRATEGY` | `shuffle` | `shuffle` \| `sequential` |
| `INPUT_SITEMAP_SAMPLE_SEED` | *(none)* | Seed for deterministic sampling |
| `INPUT_SKIP_EXTENSIONS` | `.pdf,.doc,…` | Comma-separated extensions to skip |
| `INPUT_SITEMAP_FALLBACK_TO_CRAWL` | `true` | Fall back to crawl if sitemap absent |
| `INPUT_USER_AGENT` | `a11y-dual-scanner/1.0` | HTTP user-agent string |
| `INPUT_DISCOVERY_QUERIES` | *(Tier 1)* | JSON array of custom discovery queries |
| `BING_API_KEY` | *(none)* | Bing Web Search v7 key (discover mode) |
| `BING_ENDPOINT` | Bing default | Custom Bing endpoint |
| `DISCOVER` | `false` | Enable link-crawl beyond sitemap |

---

## 11. Security

- **Static reports only** — no server-side code, no database, no authentication surface
- Reports may contain DOM snippets and selectors; treated as potentially sensitive
- No automatic upload to third-party services
- License: AGPL-3.0
- Vulnerability disclosure: see [SECURITY.md](SECURITY.md)
- Data loss protection: see [DATA_LOSS_PROTECTION.md](DATA_LOSS_PROTECTION.md)

---

## 12. Architecture & Deployment

| Aspect | Detail |
|---|---|
| **Deployment target** | GitHub Pages (static files under `/site`) |
| **Build/CI** | GitHub Actions (`a11y-scan.yml`) |
| **Report location** | `site/` — generated in CI, not committed to repo |
| **History persistence** | Prior runs restored from `gh-pages` branch before each new scan |
| **Archive management** | `scripts/archive-old-runs.js` keeps repo size manageable |
| **No backend** | All interactivity is client-side JavaScript |
| **Node.js requirement** | ≥ 24 |
| **Key runtime dependencies** | `@axe-core/playwright`, `axe-core`, `playwright`, `cheerio`, `yaml`, `xml2js`, `cron-parser` |

---

## 13. Developer Experience

### Test Suite (33 test files)

Tests are written with Jest and cover:

| Category | Test files |
|---|---|
| Report generation | `generate-report.test.js`, `generate-report-functions.test.js`, `aggregate-report.test.js` |
| Trend visualization | `trends-page.test.js`, `mini-trend-domain.test.js` |
| Discovery | `discover-top-pages.test.js` |
| Scan utilities | `scan-ci-utils.test.js`, `scan-ci-extended.test.js` |
| Sitemap & crawl | `fetch-sitemap.test.js`, `sitemap-sampling.test.js`, `extract-links.test.js`, `resolve-sitemap-seed.test.js` |
| Language filtering | `language-diversity.test.js` |
| Response filtering | `response-filter.test.js` |
| Schema validation | `shared-schema.test.js` |
| Target resolution | `targets.test.js`, `targets-extended.test.js`, `resolve-targets.script.test.js`, `resolve-targets-extended.test.js` |
| Domain extraction | `domain-extraction.test.js` |
| Workflow validation | `gh-pages-scan-workflow.test.js` |
| **Accessibility — contrast** | `pill-warning-contrast.test.js`, `run-id-contrast.test.js`, `error-message-contrast.test.js`, `status-fail-contrast.test.js` |
| **Accessibility — landmarks** | `404-landmark.test.js`, `run-page-main-landmark.test.js` |
| **Accessibility — semantics** | `html-lang-attribute.test.js`, `heading-order.test.js`, `link-in-text-block.test.js`, `logo-link-accessibility.test.js` |
| **Accessibility — interactivity** | `mini-trend-accessibility.test.js`, `light-dark-mode.test.js` |

### Development Workflow

- TDD is mandatory: write failing test → implement → refactor
- `npm test` runs the full Jest suite
- `npm run scan:ci` runs a local scan
- `npm run report` generates reports from existing scan results
- Local HTTP server support for testing against fixture pages

---

## 14. Comparison Matrix

The table below compares O-Hat Scanner against similar open-source accessibility scanning tools. Check marks (✅) indicate the feature is present; ❌ means absent or unknown; ⚠️ means partial or limited.

| Feature | **O-Hat Scanner** | Oobee | Pa11y CI | Axe CLI | Lighthouse CI |
|---|:---:|:---:|:---:|:---:|:---:|
| **Scanning** | | | | | |
| Axe-core engine | ✅ | ✅ | ✅ | ✅ | ⚠️ partial |
| Playwright browser automation | ✅ | ✅ | ❌ | ❌ | ❌ |
| Chromium support | ✅ | ✅ | ✅ | ✅ | ✅ |
| Firefox support | ✅ | ❌ | ❌ | ❌ | ❌ |
| WebKit support | ✅ | ❌ | ❌ | ❌ | ❌ |
| Mobile viewport | ✅ | ✅ | ⚠️ manual | ❌ | ✅ |
| Dark mode testing | ✅ | ❌ | ❌ | ❌ | ❌ |
| Multi-variant runs (viewport × color) | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Discovery** | | | | | |
| Sitemap crawl | ✅ | ✅ | ⚠️ basic | ❌ | ❌ |
| Recursive sitemapindex | ✅ | ❌ | ❌ | ❌ | ❌ |
| Same-origin link crawl | ✅ | ✅ | ✅ | ❌ | ❌ |
| Explicit URL list | ✅ | ✅ | ✅ | ✅ | ✅ |
| SERP-based discovery (Bing) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Required-page guarantee | ✅ | ❌ | ❌ | ❌ | ❌ |
| Language diversity filtering | ✅ | ❌ | ❌ | ❌ | ❌ |
| Sitemap sampling (shuffle/sequential/seed) | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Scheduling & CI** | | | | | |
| GitHub Actions native | ✅ | ⚠️ manual | ✅ | ✅ | ✅ |
| Cron-based per-site schedules | ✅ | ❌ | ❌ | ❌ | ❌ |
| Multi-site targets config file | ✅ | ❌ | ⚠️ JSON | ❌ | ⚠️ JSON |
| Manual dispatch with overrides | ✅ | ❌ | ❌ | ❌ | ❌ |
| Schedule simulation / testing | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Reporting** | | | | | |
| Static HTML report | ✅ | ✅ | ⚠️ basic | ❌ | ✅ |
| CSV export (Oobee schema) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Raw JSON output | ✅ | ✅ | ✅ | ✅ | ✅ |
| Print / save-as-PDF | ✅ | ❌ | ❌ | ❌ | ✅ |
| Real-time search/filter | ✅ | ❌ | ❌ | ❌ | ❌ |
| Light/dark mode toggle | ✅ | ❌ | ❌ | ❌ | ❌ |
| Trend visualization (multi-run) | ✅ | ❌ | ❌ | ❌ | ✅ |
| Mini sparklines per report | ✅ | ❌ | ❌ | ❌ | ❌ |
| Severity grouping (Must Fix / Good to Fix) | ✅ | ✅ | ❌ | ❌ | ❌ |
| WCAG SC numbers extracted from tags | ✅ | ✅ | ❌ | ❌ | ❌ |
| Copy-failure-details button | ✅ | ❌ | ❌ | ❌ | ❌ |
| No external CSS/JS dependencies | ✅ | ❌ Bootstrap | ❌ | n/a | ❌ |
| **Accessibility of the tool** | | | | | |
| WCAG 2.2 AA report pages | ✅ | ⚠️ partial | ❌ | n/a | ⚠️ partial |
| Automated a11y tests for reports | ✅ | ❌ | ❌ | n/a | ❌ |
| **Deployment** | | | | | |
| GitHub Pages (static) | ✅ | ❌ | ❌ | ❌ | ✅ |
| No backend required | ✅ | ❌ | ❌ | ✅ | ❌ |
| Historical run archive | ✅ | ❌ | ❌ | ❌ | ✅ |

> **Note:** Comparison data for third-party tools is based on publicly available documentation and may not reflect recent changes. Verify against the latest releases of each tool.

---

*Last updated: 2026-04-12. See [README.md](README.md) for quick-start instructions and [AGENTS.md](AGENTS.md) for contributor guidelines.*
