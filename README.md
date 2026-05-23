# A11y Dual Scanner

[![GitHub Pages](https://img.shields.io/badge/Pages-O--Hat--Scanner-blue?logo=github&label=pages)](https://mgifford.github.io/o-hat-scanner/)

This repository provides two accessibility scanning modes:
1. **CI Scanner**: Runs in GitHub Actions using Playwright + Axe, producing a static HTML report.
2. **Standalone Scanner**: A single HTML file you can drop into your website to scan it from the inside (same-origin).

## 🔗 Related projects

> **[mgifford/o-hat-standalone](https://github.com/mgifford/o-hat-standalone)** — standalone single-file scanner you can drop into any website to run same-origin accessibility checks directly in the browser.

> **[mgifford/open-scans](https://github.com/mgifford/open-scans)** — issue-driven accessibility scanning via a public GitHub Pages form.

**Use open-scans instead if you:**
- Want to scan a batch of URLs without forking or configuring a repo.
- Need **multi-engine comparisons** (axe-core, ALFA, IBM Equal Access, AccessLint, QualWeb) in a single run.
- Prefer a simple submit-URL-and-wait workflow rather than managing `targets.yml` and cron schedules.

**Stick with o-hat-scanner if you:**
- Need **scheduled, automated scanning** of your own sites on a recurring basis.
- Want full control over the scanning pipeline (modes, concurrency, discovery queries, viewport/color-scheme variants).
- Are integrating accessibility scanning into your own CI/CD workflow.

## ℹ️ Where the reports live (GitHub Pages)

- Reports are generated into `site/` during CI and deployed via the **GitHub Pages** workflow artifact (`github-pages`). The `site/` folder is not committed to the repo.
- The workflow first tries to restore prior runs from a `gh-pages` branch. If that branch does not exist yet, the restore step does nothing; the first successful deploy will create `gh-pages` for you.
- To view reports: after a successful `a11y-scan` run, open the run logs → **deploy-pages** step → copy the published URL (typically `https://<user>.github.io/<repo>/`).
- If you see a 404 despite a “Pages deployment reported success”, check **Settings → Pages** and ensure **Source = GitHub Actions**. Then re-run the workflow (or push to trigger) so a fresh artifact is deployed.
- If you need a local copy, run `npm run report` after scans; open `site/index.html` locally.

## 🚀 Quick Start (CI Mode)

1. **Install dependencies**:
   ```bash
   npm install
   npx playwright install --with-deps
   ```

2. **Run a local scan**:
   ```bash
   export INPUT_URLS="https://example.com"
   npm run scan:ci
   npm run report
   # View report at site/index.html
   ```

Note: The CI scanner now reads structured targets from `targets.yml` for scheduled runs. Manual dispatch can still accept a URL list input, but the preferred flow is to add sites to `targets.yml` with modes and schedules.

## ⏱️ Scheduled runs via `targets.yml`

Define the sites, modes, and cron schedules in `targets.yml` (UTC times). Example:

```yaml
sites:
   - name: va.gov
      baseUrl: https://www.va.gov
      mode: sitemap
      maxPages: 50
      schedule:
         - "0 6 * * TUE" # 1am ET Tuesday
      label: va-weekly
   - name: cms.gov
      baseUrl: https://www.cms.gov
      mode: sitemap
      maxPages: 50
      schedule:
         - "0 7 * * WED" # 2am ET Wednesday
      label: cms-random-sitemap
   - name: civicactions-list
      mode: list
      urls:
         - https://www.civicactions.com/
         - https://www.civicactions.com/blog
      schedule:
         - "0 5 * * MON" # 12am ET Monday
      maxPages: 10
      label: civicactions-list
```

- `mode`: `sitemap` (default), `crawl`, or `list`.
- `maxPages`: per-site cap (default 50).
- `schedule`: cron expressions (UTC). If omitted, the site is eligible on any manual run.
- `label`: appended to run folders/reports (`<timestamp>--<label>`).
- Manual dispatch can also pass a `site` filter and `override_label` input to rename that run without editing `targets.yml`.

The workflow resolves which sites are “due” for the current cron tick and runs them sequentially (low concurrency, capped pages) for efficiency. If no sites are due, it skips browser install and just regenerates the static site.

## ▶️ Manual Run (GitHub Actions)

Use a manual workflow run to trigger discovery + scans on demand and regenerate GitHub Pages from scratch.

### Run the Workflow Now

1. Go to your repo on GitHub → **Actions**
2. Select the **a11y-scan** workflow
3. Click **Run workflow**
4. Choose the branch (usually `main`)
5. Optional inputs:
  - `site`: run a single target from `targets.yml`
  - `override_label`: rename the run folder/report
  - leave blank to run all due targets
6. Click **Run workflow** and monitor the run

### Clear GitHub Pages and Start Fresh

If old reports still appear at https://mgifford.github.io/o-hat-scanner/, remove the existing Pages deployment and re-run:

1. GitHub → **Settings** → **Branches**
2. Delete the `gh-pages` branch if it exists
3. GitHub → **Settings** → **Pages**
4. Ensure **Source = GitHub Actions**
5. Run the **a11y-scan** workflow (steps above) to publish a clean report set

Notes:
- The `site/` folder is generated and not committed.
- A fresh workflow run will recreate `gh-pages` and republish reports.

## 🔎 Discovery Mode (Quarterly Baseline Discovery)

The **`discover`** mode runs less frequently (quarterly by default) to build a stable, curated list of canonical URLs for a domain. This is useful when you don't have a reliable sitemap or want to refresh your understanding of a site's key pages.

### How Discovery Works

For each target with `mode: discover`, the workflow will:

1. **Run discovery** using `scripts/discover-top-pages.js`:
   - Fetches SERP results via Bing Web Search API (if `BING_API_KEY` secret is set; otherwise nav-only).
   - Crawls the site navigation (homepage header/footer/nav + one-hop expansion).
   - Deduplicates candidates across sources, normalizes URLs, and resolves redirects.
   - Filters out error pages and near-duplicate content.
   - Ensures required pages (accessibility, privacy, search, terms, security) are included.
   - Scores pages by SERP prominence, nav depth, and policy keywords.
   - Outputs a curated list of up to `maxPages` canonical URLs.

2. **Scan the discovered URLs** using the existing Playwright + axe pipeline (equivalent to `mode: list`).

3. **Publish results** to GitHub Pages with discovery metadata (JSON + stats).

### Configuration

Add a discover-mode target to `targets.yml`:

```yaml
sites:
  - name: digital-gov
    baseUrl: https://digital.gov
    mode: discover
    maxPages: 100
    schedule:
      - "0 5 1 1,4,7,10 *"  # Quarterly: Jan 1, Apr 1, Jul 1, Oct 1 at 5am UTC
    label: discover-digital-gov
    notes: Quarterly discovery run to refresh top pages
```

**Key settings:**
- `mode: discover` - Enables discovery.
- `maxPages: 100` - Maximum discovered URLs (default 100); actual count may be lower if fewer unique pages found.
- `schedule` - Cron expression for when discovery runs. Default quarterly (first day of each quarter).

### SERP API Setup (Optional)

The workflow automatically selects the best available SERP source:

1. **Bing Web Search API** (preferred): If `BING_API_KEY` is configured as a GitHub Secret, Bing is used for high-quality SERP results.
   - Create a Bing Search v7 subscription on Azure.
   - Go to your repo **Settings → Secrets and variables → Actions**.
   - Add secret `BING_API_KEY` with your subscription key.
   - Optionally add `BING_ENDPOINT` (defaults to `https://api.bing.microsoft.com/v7.0/`).

2. **DuckDuckGo** (fallback, no API key required): If no `BING_API_KEY` is configured, the workflow falls back to DuckDuckGo Lite HTML parsing with respectful rate limiting.

3. **Navigation-only**: If SERP returns no results, discovery falls back to crawling the site's homepage navigation (header, footer, nav links + one-hop expansion).

The SERP source actually used is recorded in the discovery metadata JSON (`serp.provider`).

### Output

For each discover-mode target, the workflow generates:

- `site/targets/<siteKey>.urls.json` - Detailed discovery metadata:
  ```json
  {
    "baseUrl": "https://example.gov",
    "maxPages": 100,
    "generatedAt": "2026-02-16T...",
    "serp": {
      "enabled": true,
      "provider": "bing",
      "queries": ["site:example.gov", "site:example.gov accessibility", ...]
    },
    "stats": {
      "candidates": 1200,
      "afterNormalize": 980,
      "afterValidate": 850,
      "afterDedupe": 820,
      "final": 100
    },
    "requiredPages": {
      "accessibility": "https://example.gov/accessibility",
      "privacy": "https://example.gov/privacy"
    },
    "pages": [
      {
        "url": "https://example.gov/",
        "score": 5000,
        "category": "top-task",
        "signals": { "serp": {...}, "nav": {...} },
        "redirectChain": null,
        "http": { "status": 200, "contentType": "text/html" },
        "title": "...",
        "h1": "...",
        "fingerprint": "sha256-hash",
        "duplicateOf": null
      }
    ],
    "excluded": [...]
  }
  ```

- `site/targets/<siteKey>.urls.txt` - Newline-delimited list of discovered URLs (for easy Copy/Paste if needed).

- Standard scan results (in `site/runs/<runId>/`) from the subsequent accessibility scan.

### Required Pages

Discovery automatically prioritizes these page types (matched by URL pattern or keyword):

- **Accessibility Statement**: `/accessibility`, `/a11y`, `/wcag` or text matching "accessibility", "a11y", "wcag"
- **Privacy**: `/privacy` or matching "privacy", "data protection", "gdpr"
- **Search**: `/search` or matching "search"
- **Terms**: `/terms`, `/terms-of-service` or matching "terms", "conditions"
- **Cookies**: `/cookies` or matching "cookie policy"
- **Security**: `/security` or matching "security policy"
- **Home**: Always included first.

If a required page is found, it is guaranteed to be in the final list. If missing, it is reported in metadata but not invented.

### Tier 1 Discovery Queries (Government Focus)

Discovery uses a **two-tier query strategy** optimized for government and public-facing websites:

#### Tier 1: Core 7 Universal Queries (Default)

By default, all discover-mode targets use these 7 government-focused search queries:

| Query | Focus | Why It Matters |
|-------|-------|----------|
| `site:{host}` | General content | Baseline to establish primary domain content |
| `site:{host} accessibility` | Inclusive access | Critical for WCAG compliance; direct visitor need |
| `site:{host} services` | What government offers | Citizens search "what services are available" |
| `site:{host} forms` | Applications & processes | How citizens interact with government |
| `site:{host} help` | Support & troubleshooting | FAQ, contact, support pages essential for user success |
| `site:{host} privacy` | Trust & legal | Privacy statements, data handling; trust signal |
| `site:{host} contact` | Engagement | Phone, email, hours; critical for all users |

These 7 queries reflect how actual government website visitors search, emphasizing inclusivity, services, and interaction over generic "about" pages.

#### Tier 2: Custom Queries (Optional Per-Target)

To override Tier 1 for domain-specific discovery, add `discoveryQueries` to `targets.yml`:

```yaml
sites:
  - name: benefits-portal
    baseUrl: https://benefits.example.gov
    mode: discover
    maxPages: 100
    schedule:
      - "0 5 1 1,4,7,10 *"
    discoveryQueries:
      - "site:benefits.example.gov "
      - "site:benefits.example.gov apply"
      - "site:benefits.example.gov eligibility"
      - "site:benefits.example.gov income limits"
      - "site:benefits.example.gov documentation"
      - "site:benefits.example.gov application status"
      - "site:benefits.example.gov faq"

  - name: healthcare-provider
    baseUrl: https://health.example.gov
    mode: discover
    maxPages: 100
    discoveryQueries:
      - "site:health.example.gov "
      - "site:health.example.gov programs"
      - "site:health.example.gov health information"
      - "site:health.example.gov resources"
      - "site:health.example.gov insurance"
      - "site:health.example.gov enrollment"
      - "site:health.example.gov coverage"

  - name: licensing-board
    baseUrl: https://license.example.gov
    mode: discover
    maxPages: 100
    discoveryQueries:
      - "site:license.example.gov "
      - "site:license.example.gov apply"
      - "site:license.example.gov renew"
      - "site:license.example.gov fees"
      - "site:license.example.gov requirements"
      - "site:license.example.gov exam"
      - "site:license.example.gov status"
```

**Notes:**
- The `{host}` placeholder is automatically replaced with your `baseUrl` hostname.
- Custom queries completely override Tier 1 (all 7 default queries are replaced).
- Each custom list should be about 5–10 queries for best results.
- Queries can include operators like `site:`, filetype restrictions, and keyword combinations.

#### Choosing Custom Queries

Ask: **"What do visitors actually search for on this site?"**

- **Benefits/Assistance Sites**: apply, eligibility, income limits, documentation, status, faq
- **Healthcare Sites**: programs, providers, coverage, enrollment, insurance, resources
- **Licensing/Permit Boards**: apply, renew, fees, requirements, exam, status
- **Educational Institutions**: admissions, programs, courses, tuition, research, careers
- **Government Agencies**: services, reports, data, compliance, regulations, contact

If you're unsure, stick with **Tier 1 defaults** (do not set `discoveryQueries`).

### Testing Discovery Locally

Run discovery for a single domain without deploying:

```bash
export BING_API_KEY=your-api-key  # Optional; omit for nav-only
node scripts/discover-top-pages.js \
  --baseUrl https://example.gov \
  --maxPages 50 \
  --outDir ./test-discover \
  --siteKey example-gov \
  --serpProvider bing  # or 'duckduckgo' or 'none' to skip SERP
```

To use custom queries in local testing:

```bash
node scripts/discover-top-pages.js \
  --baseUrl https://example.gov \
  --maxPages 100 \
  --customQueries '["site:example.gov ","site:example.gov apply","site:example.gov eligibility"]' \
  --outDir ./test-discover \
  --siteKey example-gov \
  --serpProvider duckduckgo
```

This will output:
- `./test-discover/example-gov.urls.json` - Metadata (includes which queries were used)
- `./test-discover/example-gov.urls.txt` - URL list

### Discovery Heuristics

**Scoring** combines:
- SERP position (1st result scores higher than 10th).
- Navigation prominence (linked from homepage scores higher than secondary pages).
- Required page match (policy pages get bonus).
- Home page (always highest score).

**Filtering**:
- Removes HTTP errors (non-200), non-HTML content.
- Detects error pages by title/body keywords (404, not found, access denied, etc.) in multiple languages.
- Removes near-duplicates by comparing main text fingerprint (SHA-256).

**Deduplication**:
- Normalizes URLs (removes tracking params, fragments, trailing slashes).
- Resolves redirects up to 10 hops.
- Merges evidence across SERP and navigation sources.

**Rate Limiting**:
- Respects HTTP 429/`Retry-After` (if implemented; currently logs warnings).
- Caps body fetches at ~300 pages to limit discovery time.
- Default 15-second timeout per request.
## 🧪 Local Testing

Test the scanner against local test pages:

```bash
# Start a local HTTP server
npx http-server -p 8082 -c-1

# In another terminal, run the local scan script
node scripts/scan-local.js

# Generate reports from the scan results
node scripts/generate-report.js

# View report at site/index.html
```

The repo includes test pages in `standalone/` with intentional accessibility issues:
- `page1.html` - Missing image alt text, color contrast
- `page2.html` - Form inputs without labels
- `page3.html` - Icon buttons without accessible names, heading hierarchy
- `page4.html` - Missing lang attribute, incorrect ARIA
- `blog/post1.html` - Multiple issue types
- `auth/login.html` - Form accessibility issues

3. **Deploy to GitHub**:
   - Push this code to a repository.
   - **CRITICAL STEP**: Go to **Settings > Pages** in your repository.
   - Under **Build and deployment** > **Source**, select **GitHub Actions** (beta).
   - Go to **Actions > a11y-scan** workflow.
   - Click **Run workflow**, enter URLs (one per line) or leave blank to use `targets.txt`.
   - Once finished, view your report at `https://<user>.github.io/<repo>/`.

## 🛡️ Standalone Scanner Setup

The standalone scanner (`standalone/a11y-scan.html`) runs entirely in the browser. It is useful for testing behind VPNs or on local servers.

**Features:**
- Same-origin scanning via sitemap.xml or custom URL list
- Real-time progress tracking with live log
- JSON export of raw axe-core results
- **CSV export** with [Oobee](https://github.com/GovTechSG/oobee)-compatible schema (14 columns)
- Path prefix filtering and URL exclusions
- Configurable timeouts and delays

## 🔐 Security
Please read [SECURITY.md](SECURITY.md) for important details about access control and risk.

### ⚠️ Standalone Scanner Security
**The standalone scanner relies on same-origin policies.**
- **Do NOT** deploy it to a public production site without access control (Auth/VPN).
- It runs in the user's browser context (Potential XSS/Auth risk if misused).
- It can cause high server load (DoS risk). A minimum delay of 1000ms is enforced.
- **Mitigation:** Use Basic Auth. See `standalone/.htaccess.example`.

### Installation

1. Copy `standalone/a11y-scan.html` to your website's public root (e.g., `public/` or `www/`).
2. Vendor the `axe-core` library:
   ```bash
   npm run vendor-assets
   # Copies node_modules/axe-core/axe.min.js -> assets/axe.min.js
   ```
3. Copy the `assets/` folder to your website's public root.

Your site structure should look like:
```
/ (root)
  ├── a11y-scan.html
  ├── sitemap.xml
  └── assets/
      └── axe.min.js
```

### Usage

Visit:
`https://yoursite.com/a11y-scan.html?token=A11Y-SECRET`

(Change the token in `a11y-scan.html` source code!)

## 📊 Reports

Both scanners produce compatible JSON data in `results.json`. The GitHub Actions workflow aggregates these into a static HTML site in the `/site` directory.

### Report Features (Oobee-Inspired)

The generated reports follow professional accessibility reporting standards:

- **Professional Layout**: 2-column design with sidebar and main content area
- **Search Functionality**: Real-time filtering of issues by ID, description, or page URL
- **Summary Dashboard**: 
  - Pages scanned count
  - Pages with issues count
  - Severity breakdown (Must Fix, Good to Fix, Manual Review)
  - WCAG compliance automation coverage chart
- **Top Pages**: Ranked list of the 5 most affected pages
- **Severity Grouping**: Issues organized by impact level (critical, moderate, manual review)
- **Collapsible Sections**: Click severity headers to expand/collapse issue details
- **CSV Export**: Download results in spreadsheet format with 14 columns matching [Oobee](https://github.com/GovTechSG/oobee) schema
- **Per-Issue Details**: Violation ID, help text, impact level, affected pages, selectors, HTML snippets

### Report Files

Each scan run generates:
- `index.html` - Interactive HTML report with search and severity grouping
- `report.csv` - CSV export with columns: customFlowLabel, deviceChosen, scanCompletedAt, severity, issueId, issueDescription, wcagConformance, url, pageTitle, context, howToFix, axeImpact, xpath, learnMore
- `results.json` - Raw axe-core results
- `summary.json` - Scan metadata

### Schema

- **Results Schema**: See `scripts/shared-schema.js`.
- **Violations**: Uses `axe-core` standard output.
- **Rule Documentation**: For details on specific accessibility rules, see [Axe Rules Reference](https://dequeuniversity.com/rules/axe/html/4.11).

## Configuration

**Language Diversity Filtering:**

The scanner automatically detects and filters multilingual sites to avoid scanning duplicate content in multiple languages. This feature:

- Detects language codes in URLs (e.g., `/en/`, `/fr/`, `en.example.com`, or `/page-en`)
- Groups pages by their base path (without language component)
- Limits each page to **maximum 2 language variants** during scanning
- Promotes language diversity across the entire scan

**Example:** If a sitemap contains `/en/services`, `/fr/services`, `/es/services`, and `/de/services`, the scanner will keep only the first 2 languages encountered (e.g., `/en/services` and `/fr/services`), filtering out the others. This ensures:
- Better use of scanning budget (maxPages) 
- More diverse content coverage instead of scanning the same pages in 4+ languages
- Reduced duplicate violation reports

This filtering is applied automatically after sitemap/crawl discovery and before the scanning phase. No configuration is required.

**CI Scanner Env Vars:**
- `INPUT_URLS`: Newline separated list of URLs (used for `mode=list` or manual runs).
- `INPUT_BASE_URL`: Base origin for `mode=sitemap`/`crawl`/`discover` runs.
- `INPUT_MODE`: `sitemap` (default), `crawl`, `list`, or `discover`.
- `INPUT_LABEL`: Optional label appended to the run folder/report name.
- `INPUT_VIEWPORT_PROFILE`: `desktop` (default) or `mobile`.
- `INPUT_COLOR_SCHEME`: `light` (default) or `dark`.
- `INPUT_MAX_PAGES`: Max pages per run (default 50, capped at 200); for `discover` mode, controls the target number of discovered URLs (default 100).
- `INPUT_CONCURRENCY`: Parallel tabs (default 2).
- `INPUT_SITEMAP_SAMPLE_STRATEGY`: `shuffle` (default) randomly shuffles sitemap URLs before capping; `sequential` keeps the first entries.
- `INPUT_SITEMAP_SAMPLE_SEED`: Optional seed for deterministic sampling when using `shuffle` (helpful for reproducible manual runs).
- `INPUT_SKIP_EXTENSIONS`: Comma-separated extensions to skip during sitemap discovery (default: .pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.gz,.tgz,.tar,.rar,.7z).
- `INPUT_SITEMAP_FALLBACK_TO_CRAWL`: When `true` (default), if a sitemap is missing/empty, the scanner falls back to crawling same-origin links starting from the base URL.
- `INPUT_BROWSER`: `chromium` (default), `firefox`, or `webkit`.
- `INPUT_DISCOVERY_QUERIES`: JSON array of custom discovery queries for `discover` mode (optional; Tier 1 defaults used if omitted). Example: `["site:example.gov","site:example.gov apply"]`.
- `DISCOVER`: Set `true` to crawl links beyond sitemap (used with care).

**Discovery Secrets** (Optional; only needed if using Bing SERP API):
- `BING_API_KEY`: Bing Web Search v7 API subscription key. If not set, discovery falls back to navigation-only.
- `BING_ENDPOINT`: Optional custom Bing endpoint (defaults to `https://api.bing.microsoft.com/v7.0/`).

**Manual workflow inputs:**
- `site` to pick one target from `targets.yml`.
- `override_label` to rename that run instance.
- `viewport_profile`: `desktop` | `mobile` | `both` (creates separate runs when `both`).
- `color_scheme`: `light` | `dark` | `both` (creates separate runs when `both`).
- If both are `both`, four runs are produced: desktop-light, desktop-dark, mobile-light, mobile-dark.
- `max_pages`: overrides per-site max for that dispatch (default 50), capped at 200.

**Scheduled runs:**
- Add sites to `targets.yml` with `mode`, `maxPages`, and `schedule` crons (UTC).
- GitHub Actions resolves due sites each tick and runs only those, keeping runtime/energy lower.
- Manual dispatch can filter by `site` input or supply an ad-hoc `urls` list.
- targets.txt is optional and only used as a fallback if no URLs/targets.yml inputs are provided.

**Standalone Scanner UI:**

## 🔍 Local Dedupe and Pattern Clustering (Chrome AI)

Each generated run report includes a **"Dedupe and Patterns"** section that reduces thousands of repeated accessibility findings into actionable groups — entirely in your browser.

### Phase A: Deterministic Deduplication (always available)

Runs automatically when you open a report. No AI or internet connection required.

- Computes a **stable signature** per finding based on: rule ID, impact, normalized CSS selector, and message fingerprint.
- **Normalizes** selectors to remove fragile parts (`:nth-child`, long numeric suffix IDs like `#item-12345`).
- **Fingerprints** messages by lowercasing and replacing numbers and URLs with wildcards — so "contrast ratio 2.5:1" and "contrast ratio 3.0:1" are treated as the same issue.
- Groups findings into **DedupedGroups** with: count, pages affected, examples, and component hints.
- Shows a capped summary card (first 5,000 findings) with "show more" pagination.

### Phase B: AI-Assisted Clustering (Chrome with Prompt API only)

When the [Chrome Prompt API](https://developer.chrome.com/docs/ai/built-in) is available (Chrome ≥ 128 with Gemini Nano on-device), a **"Run local clustering"** button appears.

Clicking it:
1. Pre-buckets deduped groups by rule family (contrast, images, naming, headings, forms, focus, landmarks, tables, other).
2. Sends each bucket (up to 30 groups at a time) to the on-device model with a structured prompt.
3. The model returns clusters with: pattern name, root cause, fix steps, evidence, and confidence.
4. A final **"Top Actions"** list summarizes the highest-blast-radius fixes.

Results are cached in `localStorage` keyed to the run ID, so re-opening the report shows previous clustering without re-running. A **"Clear cached clustering"** button removes the cache.

### Browser requirements for AI clustering

| Browser | Prompt API | Supported |
|---------|------------|-----------|
| Chrome 128+ (desktop) with Gemini Nano | `window.ai.languageModel` | ✅ Yes |
| Firefox, Safari, Edge, older Chrome | — | ❌ No (deterministic groups still shown) |

### Privacy

- **No data leaves your browser.** All deduplication and AI inference runs locally.
- The findings payload embedded in the report contains only axe-core output (rule IDs, selectors, HTML snippets) — the same data already visible in the violations list above.
- The AI model is only invoked when you click the button. The report works fully without it.

### Security

- Model output is **never inserted as HTML** (`innerHTML` is not used for AI results).
- All user/scan data is rendered via `textContent` or safe DOM construction.
- HTML snippets from findings are escaped before display.

### Limitations

- AI clustering requires Chrome with the built-in Gemini Nano model downloaded.
- For very large scans (>5,000 findings), only the first 5,000 are analyzed by the dedup engine; all violations are still visible in the violations list.
- For AI clustering, only the top 200 groups by count are sent to the model; a disclosure is shown when this cap applies.
- AI results may occasionally merge unrelated groups or miss a cluster. Always verify with the deterministic groups as ground truth.

## 🤖 AI Disclosure

This project was developed with the assistance of AI tools. This section documents which AI systems have been used, in what capacity, and whether any AI is active at runtime or in the browser.

### Tools used

| AI Tool | Provider | Build-time use | Runtime use | Browser-based AI |
|---|---|---|---|---|
| **GitHub Copilot** | GitHub / Microsoft | Yes — code generation, refactoring, and test authoring across the repository. PRs authored or co-authored by the Copilot agent are labeled with the `copilot/` branch prefix. | No | No |
| **Claude (Sonnet / Opus)** | Anthropic | Yes — used via the GitHub Copilot coding agent (which runs on Claude models) to implement features (including `discover` mode, `discover-top-pages.js` script, workflow integration, CI fixes, accessibility fix for `scrollable-region-focusable` on `.fallback-prompt-text` elements, the **Local Dedupe and Pattern Clustering** feature in `scripts/dedupe-utils.js`, and the daily-perf-improver workflow integration), write documentation, fix bugs, fix the heading-order accessibility violation caused by h2 elements in dedupe summary cards (changed to h4 to avoid h2→h4 skip), and harden the GitHub Pages accessibility workflow by disabling Copilot issue assignment after a `Bad credentials` filing failure (with a matching workflow test update). | No | No |
| **Daily Perf Improver (GitHubNext)** | GitHub | Yes — automated daily performance analysis agent (`.github/workflows/daily-perf-improver.md`). Discovers commands, identifies optimization opportunities, implements improvements with measured impact, and maintains a monthly activity summary. Requires `gh aw compile` to activate. | No | No |
| **Chrome Prompt API (Gemini Nano on-device)** | Google | No | No | Yes — the run-page Insights panel optionally calls `window.ai.languageModel` if the user's browser supports it. Invocation is user-initiated; all inference is local. Reports degrade gracefully when the API is unavailable. The new **Dedupe and Patterns** section also uses `window.ai.languageModel` for optional AI-assisted pattern clustering (Phase B). |

### Explanatory notes

- **Build-time use**: Both tools above assisted human developers in writing and reviewing source code, scripts, tests, and documentation. No code was committed without human review of a pull request.
- **Runtime use**: The scanner itself (Playwright + axe-core) does **not** call any LLM or AI API during a scan. Reports are generated from static axe-core rule output with no AI post-processing.
- **Browser-based AI**: The generated static HTML reports now include an **opt-in Insights panel** that can invoke the [Chrome Prompt API](https://developer.chrome.com/docs/ai/built-in) (`window.ai.languageModel`) if available on the user's device. This is entirely optional — the panel gracefully degrades to a "copy prompt" fallback when the API is not available. No data is sent to any external server; all inference runs locally in the browser. The model is only invoked when the user explicitly clicks a "Generate" button.
- **Bing Search API**: The optional `discover` mode can call the Bing Web Search v7 API (a search index, not a generative AI) when a `BING_API_KEY` secret is configured. This is a traditional keyword search service and is not an LLM.

> **Keep this section current.** If you add or use a new AI tool while contributing to this repository, update this table per the instructions in `AGENTS.md`.

### Activating the Daily Perf Improver (GitHubNext)

The workflow source is committed at `.github/workflows/daily-perf-improver.md`. To compile and enable it, install the [GitHub Agentic Workflows extension](https://github.com/github/gh-aw) and run:

```bash
gh extension install github/gh-aw
gh aw compile .github/workflows/daily-perf-improver.md
```

Commit the generated `.lock.yml` file and the workflow will run daily, identifying and implementing performance improvements autonomously. You can also trigger it on demand by commenting `/perf-assist <instructions>` on any issue or pull request.

## License

AGPL-3.0 - See [LICENSE](LICENSE) for details.
