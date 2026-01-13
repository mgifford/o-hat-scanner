# A11y Dual Scanner

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

3. **Deploy to GitHub**:
   - Push this code to a repository.
   - Go to **Settings > Pages** and set source to "GitHub Actions".
   - Go to **Actions > a11y-scan** workflow.
   - Click **Run workflow**, enter URLs (one per line).
   - Once finished, view your report at `https://<user>.github.io/<repo>/`.

## 🛡️ Standalone Scanner Setup

The standalone scanner (`standalone/a11y-scan.html`) runs entirely in the browser. It is useful for testing behind VPNs or on local servers.

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

- **Results Schema**: See `scripts/shared-schema.js`.
- **Violations**: Uses `axe-core` standard output.

## Configuration

**CI Scanner Env Vars:**
- `INPUT_URLS`: Newline separated list of URLs.
- `INPUT_MAX_PAGES`: Max pages to crawl (default 50).
- `INPUT_CONCURRENCY`: Parallel tabs (default 2).
- `DISCOVER`: Set `true` to crawl links beyond sitemap.

**Standalone Scanner UI:**
- Configure max pages, path prefixes, and exclusions directly in the browser interface.

## License

MIT
