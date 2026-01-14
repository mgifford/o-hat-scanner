# A11y Dual Scanner

[![GitHub Pages](https://img.shields.io/badge/Pages-O--Hat--Scanner-blue?logo=github&label=pages)](https://mgifford.github.io/o-hat-scanner/)

This repository provides two accessibility scanning modes:
1. **CI Scanner**: Runs in GitHub Actions using Playwright + Axe, producing a static HTML report.
2. **Standalone Scanner**: A single HTML file you can drop into your website to scan it from the inside (same-origin).

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
- **CSV export** with Oobee-compatible schema (14 columns)
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
- **CSV Export**: Download results in spreadsheet format with 14 columns matching Oobee schema
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

## Configuration

**CI Scanner Env Vars:**
- `INPUT_URLS`: Newline separated list of URLs (used for `mode=list` or manual runs).
- `INPUT_BASE_URL`: Base origin for `mode=sitemap`/`crawl` runs.
- `INPUT_MODE`: `sitemap` (default), `crawl`, or `list`.
- `INPUT_LABEL`: Optional label appended to the run folder/report name.
- `INPUT_VIEWPORT_PROFILE`: `desktop` (default) or `mobile`.
- `INPUT_COLOR_SCHEME`: `light` (default) or `dark`.
- `INPUT_MAX_PAGES`: Max pages per run (default 50).
- `INPUT_CONCURRENCY`: Parallel tabs (default 2).
- `DISCOVER`: Set `true` to crawl links beyond sitemap (used with care).

**Manual workflow inputs:**
- `site` to pick one target from `targets.yml`.
- `override_label` to rename that run instance.
- `viewport_profile`: `desktop` | `mobile` | `both` (creates separate runs when `both`).
- `color_scheme`: `light` | `dark` | `both` (creates separate runs when `both`).
- If both are `both`, four runs are produced: desktop-light, desktop-dark, mobile-light, mobile-dark.

**Scheduled runs:**
- Add sites to `targets.yml` with `mode`, `maxPages`, and `schedule` crons (UTC).
- GitHub Actions resolves due sites each tick and runs only those, keeping runtime/energy lower.
- Manual dispatch can filter by `site` input or supply an ad-hoc `urls` list.

**Standalone Scanner UI:**

## License

AGPL-3.0 - See [LICENSE](LICENSE) for details.
