import fs from 'fs';
import path from 'path';

const SITE_DIR = 'site';
const RUNS_DIR = path.join(SITE_DIR, 'runs');

// Severity levels based on axe impact
const SEVERITY_MAP = {
    critical: { label: 'Must Fix', order: 1, color: '#d32f2f' },
    serious: { label: 'Must Fix', order: 1, color: '#d32f2f' },
    moderate: { label: 'Good to Fix', order: 2, color: '#f57c00' },
    minor: { label: 'Good to Fix', order: 2, color: '#f57c00' },
    'review': { label: 'Manual Review Required', order: 3, color: '#1976d2' }
};

function main() {
    if (!fs.existsSync(SITE_DIR)) {
        fs.mkdirSync(SITE_DIR, { recursive: true });
    }
    if (!fs.existsSync(RUNS_DIR)) {
        fs.mkdirSync(RUNS_DIR, { recursive: true });
        console.log('No runs found. Generating empty index.');
        generateMainIndex([]);
        return;
    }

    const runs = fs.readdirSync(RUNS_DIR).filter(d => fs.statSync(path.join(RUNS_DIR, d)).isDirectory());
    const runSummaries = [];

    // Generate per-run pages
    for (const runId of runs) {
        const runPath = path.join(RUNS_DIR, runId);
        const resultsPath = path.join(runPath, 'results.json');
        
        if (fs.existsSync(resultsPath)) {
            const results = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));
            const pageStats = analyzeResults(results);
            generateRunPage(runId, results, pageStats); // creates site/runs/<id>/index.html
            generateCSV(runId, results); // creates site/runs/<id>/report.csv
            
            // Collect summary for main index
            const summaryPath = path.join(runPath, 'summary.json');
            if (fs.existsSync(summaryPath)) {
                runSummaries.push(JSON.parse(fs.readFileSync(summaryPath, 'utf-8')));
            }
        }
    }

    // Generate main index
    generateMainIndex(runSummaries);
}

function generateMainIndex(summaries) {
    summaries.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>O-Hat Scanner - Accessibility Reports</title>
    <style>
        * { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background: #f5f5f5; color: #222; }
        a { color: #1976d2; text-decoration: none; }
        a:hover { text-decoration: underline; }
        header { background: linear-gradient(135deg, #0d47a1 0%, #1976d2 100%); color: #fff; padding: 3rem 1rem; }
        .header-content { max-width: 1000px; margin: 0 auto; }
        h1 { font-size: 32px; font-weight: 700; margin: 0 0 0.5rem 0; }
        .tagline { font-size: 18px; color: #e3f2fd; margin: 0; }
        main { max-width: 1000px; margin: 2rem auto; padding: 0 1rem; }
        .intro { background: #fff; padding: 2rem; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 2rem; }
        .intro h2 { margin-top: 0; color: #0d47a1; }
        .intro p { line-height: 1.6; margin: 1rem 0; }
        .features { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; margin: 2rem 0; }
        .feature { background: #fff; padding: 1.5rem; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .feature h3 { color: #0d47a1; margin-top: 0; }
        .feature p { margin: 0.5rem 0; line-height: 1.5; }
        .reports-section { background: #fff; padding: 2rem; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin: 2rem 0; }
        .reports-section h2 { color: #0d47a1; margin-top: 0; }
        .table-wrapper { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; margin-top: 1rem; min-width: 720px; }
        th, td { text-align: left; padding: 0.75rem; border-bottom: 1px solid #ddd; vertical-align: top; }
        th { background: #f4f4f4; font-weight: 600; }
        .sort-btn { background: transparent; border: none; font: inherit; color: #0d47a1; cursor: pointer; padding: 0; }
        .sort-btn:focus { outline: 2px solid #0d47a1; outline-offset: 2px; }
        .status-pass { color: green; }
        .status-fail { color: red; font-weight: bold; }
        .target-cell { display: flex; flex-direction: column; gap: 4px; }
        .target-main { font-weight: 700; }
        .target-meta { font-size: 12px; color: #555; }
        .run-id { font-family: ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace; opacity: 0.6; }
        tr:hover .run-id, tr:focus-within .run-id { opacity: 1; }
        footer { text-align: center; padding: 2rem 1rem; color: #666; font-size: 14px; }
    </style>
</head>
<body>
    <header>
        <div class="header-content">
            <h1>🎩 O-Hat Scanner</h1>
            <p class="tagline">Oobee-style accessibility reports powered by GitHub Actions & Pages</p>
            <p style="margin-top: 1rem;"><a href="https://github.com/mgifford/o-hat-scanner" style="color: #bbdefb; font-weight: 600;">View on GitHub →</a></p>
        </div>
    </header>
    
    <main>
        <div class="intro">
            <h2>Automated Accessibility Scanning</h2>
            <p>O-Hat Scanner provides <strong>professional accessibility reports in GitHub Pages</strong> using GitHub Actions. It combines the power of <strong>axe-core</strong> testing with <strong>Oobee-inspired reporting</strong> to deliver clear, actionable insights into web accessibility.</p>
            <p>Scan reports feature:</p>
            <ul>
                <li>Professional, searchable HTML reports with severity grouping</li>
                <li>WCAG 2.2 automation coverage tracking</li>
                <li>Top affected pages ranking</li>
                <li>CSV export for integration with spreadsheets</li>
                <li>Collapsible severity sections with detailed violation info</li>
            </ul>
        </div>
        
        <div class="features">
            <div class="feature">
                <h3>🤖 CI Scanner</h3>
                <p>Runs in GitHub Actions against a list of URLs. Automatically scans on push, generates reports, and deploys to GitHub Pages.</p>
            </div>
            <div class="feature">
                <h3>🏠 Standalone Scanner</h3>
                <p>Deploy a single HTML file to your site for same-origin scanning. Perfect for local testing, VPNs, or staging environments.</p>
                <p><a href="#standalone">Learn more →</a></p>
            </div>
            <div class="feature">
                <h3>📊 Oobee Reports</h3>
                <p>Beautiful, professional reports inspired by GovTechSG's Oobee. Search issues, filter by severity, view top pages.</p>
            </div>
        </div>
        
        <div class="reports-section">
            <h2>Recent Scan Reports</h2>
            ${summaries.length === 0 ? '<p>No scan reports yet. Check back after the first scan completes.</p>' : `
            <p>View detailed accessibility reports from recent scans:</p>
            <div class="table-wrapper">
            <table aria-live="polite">
                <thead>
                    <tr>
                        <th><button class="sort-btn" data-sort="startedAt">Date</button></th>
                        <th><button class="sort-btn" data-sort="target">Target</button></th>
                        <th><button class="sort-btn" data-sort="viewport">Viewport</button></th>
                        <th><button class="sort-btn" data-sort="colorScheme">Color</button></th>
                        <th><button class="sort-btn" data-sort="browser">Browser</button></th>
                        <th><button class="sort-btn" data-sort="pagesScanned">Pages</button></th>
                        <th><button class="sort-btn" data-sort="totalViolations">Total occurrences</button></th>
                        <th>Report</th>
                    </tr>
                </thead>
                <tbody>
                    ${summaries.map((s, i) => {
                        const started = s.startedAt ? new Date(s.startedAt).toLocaleString() : 'N/A';
                        const runShort = s.runId ? `${s.runId.slice(0, 8)}…` : 'n/a';
                        return `
                        <tr data-started-at="${esc(s.startedAt || '')}" data-target="${esc(s.target || '')}" data-viewport="${esc(s.viewport || '')}" data-color-scheme="${esc(s.colorScheme || '')}" data-browser="${esc(s.browser || '')}" data-pages="${s.pagesScanned ?? ''}" data-total="${s.totalViolations ?? ''}" data-idx="${i}">
                            <td>${started}</td>
                            <td>
                                <div class="target-cell">
                                    <div class="target-main">${esc(s.target || 'Unknown')}</div>
                                    <div class="target-meta">Run ID <span class="run-id" title="${esc(s.runId || '')}" aria-label="Run ID ${esc(s.runId || '')}">${esc(runShort)}</span></div>
                                </div>
                            </td>
                            <td>${esc(s.viewport || 'desktop')}</td>
                            <td>${esc(s.colorScheme || 'light')}</td>
                            <td>${esc(s.browser || 'chromium')}</td>
                            <td>${s.pagesScanned ?? '—'}</td>
                            <td class="${(s.totalViolations || 0) > 0 ? 'status-fail' : 'status-pass'}">${s.totalViolations ?? 0}</td>
                            <td><a href="runs/${esc(s.runId)}/index.html" aria-label="Open report for ${esc(s.target || 'run')} in new page">View →</a></td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
            </div>
            `}
        </div>
        
        <div class="intro" id="standalone">
            <h2>📦 Standalone Scanner</h2>
            <p>The O-Hat Scanner includes a standalone HTML file that runs accessibility scans directly in your browser (same-origin only).</p>
            <p><strong>Features:</strong></p>
            <ul>
                <li>No server required—runs entirely in the browser</li>
                <li>Discovers pages via sitemap.xml</li>
                <li>Real-time progress tracking</li>
                <li>JSON + CSV export with Oobee schema</li>
                <li>Token-based access control</li>
            </ul>
            <p><strong>Learn more:</strong> See the <a href="https://github.com/mgifford/o-hat-scanner">GitHub repository</a> for setup and configuration.</p>
        </div>
    </main>
    
    <footer>
        <p>O-Hat Scanner | <a href="https://github.com/mgifford/o-hat-scanner">GitHub</a> | Built with <a href="https://github.com/dequelabs/axe-core">axe-core</a></p>
    </footer>

    <script>
        const tbody = document.querySelector('tbody');
        const sortButtons = document.querySelectorAll('.sort-btn');
        let sortState = { key: 'startedAt', dir: 'desc' };

        function valueFor(row, key) {
            switch (key) {
                case 'startedAt':
                    return Date.parse(row.dataset.startedAt || 0) || 0;
                case 'pagesScanned':
                    return parseInt(row.dataset.pages || '0', 10) || 0;
                case 'totalViolations':
                    return parseInt(row.dataset.total || '0', 10) || 0;
                default:
                    return (row.dataset[key] || '').toLowerCase();
            }
        }

        function applySort(key) {
            if (sortState.key === key) {
                sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
            } else {
                sortState = { key, dir: key === 'startedAt' ? 'desc' : 'asc' };
            }

            const rows = Array.from(tbody.querySelectorAll('tr'));
            rows.sort((a, b) => {
                const va = valueFor(a, sortState.key);
                const vb = valueFor(b, sortState.key);
                if (va < vb) return sortState.dir === 'asc' ? -1 : 1;
                if (va > vb) return sortState.dir === 'asc' ? 1 : -1;
                // stable fallback to original order
                const ia = parseInt(a.dataset.idx || '0', 10);
                const ib = parseInt(b.dataset.idx || '0', 10);
                return ia - ib;
            });

            rows.forEach(r => tbody.appendChild(r));
            updateSortIndicators();
        }

        function updateSortIndicators() {
            sortButtons.forEach(btn => {
                const th = btn.parentElement;
                const dir = btn.dataset.sort === sortState.key ? (sortState.dir === 'asc' ? 'ascending' : 'descending') : 'none';
                th.setAttribute('aria-sort', dir);
            });
        }

        sortButtons.forEach(btn => {
            btn.addEventListener('click', () => applySort(btn.dataset.sort));
        });

        updateSortIndicators();
    </script>
</body>
</html>`;

    fs.writeFileSync(path.join(SITE_DIR, 'index.html'), html);
    console.log('Generated main index.');
}

function generateRunPage(runId, results, pageStats) {
    const urls = Object.keys(results.resultsByUrl);
    const processedUrls = urls;
    const { mustFixCount, goodToFixCount, reviewCount, pagesWithIssues, automationCoverage } = pageStats;
    const totalIssues = mustFixCount + goodToFixCount + reviewCount;
    const topPages = getTopPages(results);
    const runDate = results.startedAt ? new Date(results.startedAt) : new Date();
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const primaryTarget = (results.targets && results.targets[0]) || urls[0] || 'N/A';
        const runDir = path.join(SITE_DIR, 'runs', runId);
        const cfg = results.config || {};
        const viewportLabel = cfg.viewport === 'mobile' ? 'Mobile' : 'Desktop';
        const colorLabel = cfg.colorScheme === 'dark' ? 'Dark' : 'Light';
        const browserLabel = (cfg.browser || 'chromium').toLowerCase();
    fs.mkdirSync(runDir, { recursive: true });

    const html = `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Scan Report: ${esc(runId)}</title>
    <style>
        :root {
            color-scheme: light;
            --bg: #f5f5f5;
            --panel-bg: #fff;
            --panel-border: #e0e0e0;
            --text: #222;
            --muted: #666;
            --link: #1976d2;
            --link-visited: #5e35b1;
            --header-grad-start: #0d47a1;
            --header-grad-end: #1976d2;
            --header-text: #fff;
            --pill-critical: #d32f2f;
            --pill-warning: #f57c00;
            --pill-info: #1976d2;
            --card-bg: #fafafa;
            --bar-bg: #e0e0e0;
            --code-bg: #f5f5f5;
            --focus: #90caf9;
        }
        [data-theme="dark"] {
            color-scheme: dark;
            --bg: #0f141a;
            --panel-bg: #121826;
            --panel-border: #1f2937;
            --text: #e5e7eb;
            --muted: #9ca3af;
            --link: #7cb7ff;
            --link-visited: #c4b5fd;
            --header-grad-start: #0b1f3a;
            --header-grad-end: #163c6b;
            --header-text: #e5e7eb;
            --pill-critical: #ef4444;
            --pill-warning: #f59e0b;
            --pill-info: #3b82f6;
            --card-bg: #1f2937;
            --bar-bg: #1f2937;
            --code-bg: #111827;
            --focus: #7cb7ff;
        }
        * { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background: var(--bg); color: var(--text); }
        a { color: var(--link); text-decoration: none; }
        a:hover { text-decoration: underline; }
        a:visited { color: var(--link-visited); }
        h1, h2, h3, h4 { margin: 0; }

        header { background: linear-gradient(135deg, var(--header-grad-start) 0%, var(--header-grad-end) 100%); color: var(--header-text); padding: 2rem 1rem; }
        .header-content { max-width: 1200px; margin: 0 auto; display: flex; flex-direction: column; gap: 0.5rem; }
        .header-actions { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; }
        .back-link { color: var(--link); font-size: 14px; display: inline-block; }
        .back-link:hover { color: var(--header-text); }
        h1 { font-size: 28px; font-weight: 700; }
        .meta { margin-top: 0.25rem; font-size: 14px; color: var(--header-text); opacity: 0.9; }
        .meta strong { color: var(--header-text); }
        .download-link { display: inline-block; margin-top: 0.5rem; padding: 10px 16px; background: var(--panel-bg); color: var(--header-grad-start); border-radius: 4px; font-weight: 600; border: 1px solid var(--panel-border); }
        .download-link:hover { background: var(--card-bg); text-decoration: none; }

        .container { max-width: 1200px; margin: -40px auto 0 auto; padding: 0 1rem 2rem 1rem; }
        .layout { display: grid; grid-template-columns: 2fr 0.9fr; gap: 1.5rem; align-items: start; }
        @media (max-width: 960px) { .layout { grid-template-columns: 1fr; } }

        .panel { background: var(--panel-bg); border: 1px solid var(--panel-border); border-radius: 6px; box-shadow: 0 6px 18px rgba(0,0,0,0.04); padding: 1.5rem; }
        .panel + .panel { margin-top: 1rem; }
        .panel h3 { font-size: 16px; font-weight: 700; color: var(--text); margin-bottom: 0.75rem; }
        .panel small { color: var(--muted); }

        .search-row { display: flex; gap: 0.75rem; margin-bottom: 1rem; flex-wrap: wrap; align-items: center; }
        .search-input { flex: 1 1 260px; padding: 10px 12px; border: 1px solid var(--panel-border); border-radius: 4px; font-size: 14px; background: var(--panel-bg); color: var(--text); }
        .search-input:focus { outline: 2px solid var(--focus); border-color: var(--focus); }

        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 1rem; }
        .card { background: var(--card-bg); border: 1px solid var(--panel-border); border-radius: 6px; padding: 1rem; }
        .card h4 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted); margin-bottom: 0.35rem; }
        .card .value { font-size: 30px; font-weight: 700; color: var(--text); }
        .card.critical .value { color: var(--pill-critical); }
        .card.warning .value { color: var(--pill-warning); }
        .card.info .value { color: var(--pill-info); }
        .card .subtext { font-size: 12px; color: var(--muted); margin-top: 4px; }

        .bar { background: var(--bar-bg); height: 22px; border-radius: 4px; overflow: hidden; display: flex; margin: 10px 0; }
        .bar-segment { height: 100%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 12px; font-weight: 700; }
        .bar-auto { background: var(--pill-info); }

        .top-pages { display: grid; gap: 0.5rem; }
        .page-row { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; border: 1px solid var(--panel-border); border-radius: 4px; }
        .page-row .url { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size: 13px; overflow-wrap: anywhere; color: var(--text); }
        .pill { padding: 4px 10px; border-radius: 999px; font-weight: 700; font-size: 12px; white-space: nowrap; color: #fff; }

        .issues-by-severity { margin-top: 1.5rem; }
        .severity-group { border: 1px solid var(--panel-border); border-radius: 6px; overflow: hidden; margin-bottom: 1rem; }
        .severity-header { background: var(--card-bg); padding: 1rem; display: flex; justify-content: space-between; align-items: center; cursor: pointer; border: none; width: 100%; text-align: left; color: var(--text); }
        .severity-header .title { font-weight: 700; }
        .severity-header .count { background: #e0e0e0; padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: 700; color: #111; }
        [data-theme="dark"] .severity-header .count { background: #1f2937; color: var(--text); }
        .severity-content { padding: 1rem; }

        .violation-item { border-bottom: 1px solid var(--panel-border); padding: 0.75rem 0; }
        .violation-item:last-child { border-bottom: none; }
        .violation-id { font-weight: 700; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; color: var(--text); }
        .violation-help { color: var(--muted); margin: 4px 0 6px 0; }
        .violation-meta { font-size: 12px; color: var(--muted); margin-bottom: 8px; }
        .node-list { background: var(--card-bg); border: 1px solid var(--panel-border); border-radius: 4px; padding: 10px; font-size: 13px; }
        .node-item { margin-bottom: 8px; }
        .node-item:last-child { margin-bottom: 0; }
        .node-url { font-weight: 700; color: var(--text); }
        .node-selector { color: var(--link); font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
        .node-html { margin-top: 4px; color: var(--text); font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; overflow-wrap: anywhere; background: var(--code-bg); padding: 6px; border-radius: 4px; }

        .pill-critical { background: var(--pill-critical); }
        .pill-warning { background: var(--pill-warning); }
        .pill-info { background: var(--pill-info); }

        .no-violations { background: #11321b; border: 1px solid #1f5d2f; border-radius: 6px; padding: 1rem; color: #b7f7c0; font-weight: 600; }
        [data-theme="light"] .no-violations { background: #e8f5e9; border-color: #c8e6c9; color: #2e7d32; }

        .back-link:focus,
        .download-link:focus,
        .search-input:focus,
        .severity-header:focus,
        .debug-accordion summary:focus,
        .theme-toggle:focus {
            outline: 2px solid var(--focus);
            outline-offset: 2px;
        }

        .theme-toggle { background: var(--panel-bg); color: var(--text); border: 1px solid var(--panel-border); border-radius: 4px; padding: 8px 12px; cursor: pointer; font-weight: 600; }
    </style>
</head>
<body>
    <a href="#main" style="position:absolute;left:-999px;top:-999px;">Skip to main content</a>
    <header>
        <div class="header-content">
            <div class="header-actions">
                <a href="../../index.html" class="back-link">← Back to all runs</a>
                <button class="theme-toggle" type="button" aria-label="Toggle light or dark mode">Toggle light/dark</button>
            </div>
            <h1>Accessibility Scan Report</h1>
            <p class="meta">
                <strong>Scan ID:</strong> ${esc(runId)} · <strong>Date:</strong> ${runDate.toLocaleString()} · <strong>Mode:</strong> ${esc(results.mode || 'unknown')} · <strong>Viewport:</strong> ${viewportLabel} · <strong>Color:</strong> ${colorLabel}
            </p>
            <a href="report.csv" class="download-link" download>Download CSV</a>
        </div>
    </header>

    <div class="container">
        <div class="layout">
            <!-- Main column -->
            <div class="panel">
                <div class="search-row">
                    <label for="issueSearch">Search issues</label>
                    <input id="issueSearch" class="search-input" type="search" placeholder="Search issues (ID, description, page)..." aria-label="Search issues">
                </div>

                <div class="summary-grid">
                    <div class="card">
                        <h4>Pages scanned</h4>
                        <div class="value">${urls.length}</div>
                        <div class="subtext">Targets from sitemap or config</div>
                    </div>
                    <div class="card">
                        <h4>Pages with issues</h4>
                        <div class="value">${pagesWithIssues}</div>
                        <div class="subtext">${Math.round((pagesWithIssues / Math.max(urls.length, 1)) * 100)}% of pages</div>
                    </div>
                    <div class="card critical">
                        <h4>Must Fix</h4>
                        <div class="value">${mustFixCount}</div>
                        <div class="subtext">Critical / Serious impacts</div>
                    </div>
                    <div class="card warning">
                        <h4>Good to Fix</h4>
                        <div class="value">${goodToFixCount}</div>
                        <div class="subtext">Moderate / Minor impacts</div>
                    </div>
                    <div class="card info">
                        <h4>Manual review</h4>
                        <div class="value">${reviewCount}</div>
                        <div class="subtext">Potential false positives</div>
                    </div>
                </div>

                <div class="panel" style="margin-top: 1rem;">
                    <h3>WCAG compliance snapshot</h3>
                    <small>Automated coverage only; manual verification still required.</small>
                    <div class="bar" aria-label="Automation coverage">
                        <div class="bar-segment bar-auto" style="width: ${automationCoverage}%">${automationCoverage}% automation</div>
                        <div class="bar-segment" style="background:#e0e0e0; width: ${100 - automationCoverage}%"></div>
                    </div>
                </div>

                ${topPages.length ? `
                <div class="panel" style="margin-top: 1rem;">
                    <h3>Top pages to review</h3>
                    <div class="top-pages">
                        ${topPages.map(({ url, count, severity }) => `
                            <div class="page-row">
                                <div class="url"><a href="${esc(url)}" target="_blank" rel="noopener">${esc(url)}</a></div>
                                <span class="pill ${severity === 'critical' ? 'pill-critical' : severity === 'moderate' ? 'pill-warning' : 'pill-info'}">${count} issues</span>
                            </div>
                        `).join('')}
                    </div>
                </div>` : ''}

                <div class="panel issues-by-severity" style="margin-top: 1rem;">
                    <h3>Issues grouped by impact</h3>
                    ${['critical', 'moderate', 'review'].map(severity => {
                        const label = SEVERITY_MAP[severity]?.label || severity;
                        const groupIssues = getIssuesByViolationType(results, severity);
                        const total = countTotalNodes(groupIssues);
                        if (!groupIssues.length) return '';
                        const pillClass = severity === 'critical' ? 'pill-critical' : severity === 'moderate' ? 'pill-warning' : 'pill-info';
                        return `
                        <div class="severity-group" data-severity="${severity}">
                            <button class="severity-header" type="button" aria-expanded="${severity === 'critical'}">
                                <span class="title">${label}</span>
                                <span class="count ${pillClass}">${total} occurrences</span>
                            </button>
                            <div class="severity-content">
                                ${groupIssues.map(({ violationId, help, impact, helpUrl, pages }) => `
                                    <div class="violation-item" data-violation="${esc(violationId)}">
                                        <div class="violation-id">${esc(violationId)}</div>
                                        <div class="violation-help">${esc(help)}</div>
                                        <div class="violation-meta">Impact: ${esc(impact || 'unknown')} · Pages with issue: ${pages.size}</div>
                                        ${helpUrl ? `<div><a href="${esc(helpUrl)}" target="_blank" rel="noopener">Learn more</a></div>` : ''}
                                        <div class="node-list">
                                            ${[...pages.values()].slice(0, 5).map(({ url, nodes }) => `
                                                <div class="node-item">
                                                    <div class="node-url"><a href="${esc(url)}" target="_blank" rel="noopener">${esc(url)}</a> (${nodes.length} node${nodes.length !== 1 ? 's' : ''})</div>
                                                    ${nodes.slice(0, 1).map(node => `
                                                        <div class="node-selector">Selector: ${esc(node.target?.join(', ') || 'N/A')}</div>
                                                        ${node.html ? `<div class="node-html">${esc(node.html.substring(0, 200))}</div>` : ''}
                                                        ${node.failureSummary ? `<div class="node-html">${esc(node.failureSummary)}</div>` : ''}
                                                    `).join('')}
                                                </div>
                                            `).join('')}
                                            ${pages.size > 5 ? `<div class="node-item">... ${pages.size - 5} more page${pages.size - 5 === 1 ? '' : 's'}</div>` : ''}
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>`;
                    }).join('')}
                    ${totalIssues === 0 ? '<div class="no-violations"><p>✓ No accessibility issues found.</p></div>' : ''}
                </div>
            </div>

            <!-- Sidebar -->
            <div class="panel">
                <h3>About this scan</h3>
                <div style="margin-bottom: 0.5rem; font-weight: 600;">${runDate.toLocaleString()} (${timezone})</div>
                <div style="margin-bottom: 0.25rem;">Target: ${esc(primaryTarget)}</div>
                <div style="margin-bottom: 0.25rem;">Viewport: ${viewportLabel}</div>
                <div style="margin-bottom: 0.25rem;">Color scheme: ${colorLabel}</div>
                <div style="margin-bottom: 0.25rem;">Browser: ${esc(browserLabel)}</div>
                <div style="margin-bottom: 0.25rem;">Mode: ${esc(results.mode || 'ci')}</div>
                <div style="margin-top: 0.5rem;">Pages crawled: ${processedUrls.length}</div>
                <div>Total occurrences: ${totalIssues}</div>
            </div>
        </div>
    </div>

    <div class="container" aria-label="Debug information" style="margin-top: 0;">
        <div class="panel" style="margin-top: 1rem; background-color: #f5f0d9; border: 1px solid #d8cfa3;">
            <details class="debug-accordion">
                <summary style="cursor: pointer; font-weight: 600; outline: none;">Debug info (run config)</summary>
                <div style="margin-top: 0.75rem;">
                    <ul style="margin-top: 0.25rem; padding-left: 1.25rem; line-height: 1.5;">
                        <li>Mode: ${esc(results.mode || cfg.mode || 'ci')}</li>
                        <li>Viewport: ${esc(cfg.viewport || 'desktop')}</li>
                        <li>Color scheme: ${esc(cfg.colorScheme || 'light')}</li>
                        <li>Browser: ${esc(cfg.browser || 'chromium')}</li>
                        <li>Max pages: ${esc(cfg.maxPages ?? 'N/A')}</li>
                        <li>Concurrency: ${esc(cfg.concurrency ?? 'N/A')}</li>
                        <li>Timeout (ms): ${esc(cfg.timeout ?? 'N/A')}</li>
                        <li>Base URL: ${esc(cfg.baseUrl || 'N/A')}</li>
                        <li>Targets: ${esc((results.targets || []).join(', ') || 'N/A')}</li>
                        <li>Sampling: ${esc(cfg.sitemapSample?.strategy || 'shuffle')} ${cfg.sitemapSample?.seed ? `(seed ${esc(cfg.sitemapSample.seed)})` : ''}</li>
                        <li>Results URLs: ${processedUrls.length}</li>
                        <li>Finished: ${results.finishedAt ? esc(results.finishedAt) : 'N/A'}</li>
                    </ul>
                    ${renderErrors(results)}
                </div>
            </details>
        </div>
    </div>

    <script>
        // Toggle severity blocks (keyboard accessible)
        document.querySelectorAll('.severity-header').forEach(header => {
            const content = header.nextElementSibling;
            if (header.getAttribute('aria-expanded') === 'true') {
                content.style.display = 'block';
            }
            header.addEventListener('click', () => {
                const expanded = header.getAttribute('aria-expanded') === 'true';
                header.setAttribute('aria-expanded', String(!expanded));
                content.style.display = expanded ? 'none' : 'block';
            });
        });

        // Simple search filtering across issue text and IDs
        const searchInput = document.getElementById('issueSearch');
        searchInput?.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            document.querySelectorAll('.violation-item').forEach(item => {
                const text = item.textContent.toLowerCase();
                item.style.display = text.includes(term) ? 'block' : 'none';
            });
        });

        // Theme toggle with persistence
        const themeToggle = document.querySelector('.theme-toggle');
        const root = document.documentElement;
        const saved = localStorage.getItem('report-theme');
        if (saved === 'dark' || (saved === null && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            root.setAttribute('data-theme', 'dark');
        }
        themeToggle?.addEventListener('click', () => {
            const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            root.setAttribute('data-theme', next);
            localStorage.setItem('report-theme', next);
        });
    </script>
</body>
</html>`;

    fs.writeFileSync(path.join(runDir, 'index.html'), html);
}

if (process.env.NODE_ENV !== 'test') {
    main();
}

function generateCSV(runId, results) {
    const headers = [
        "customFlowLabel","deviceChosen","scanCompletedAt","severity","issueId",
        "issueDescription","wcagConformance","url","pageTitle","context",
        "howToFix","axeImpact","xpath","learnMore"
    ];

    let csvContent = headers.map(h => `"${h}"`).join(",") + "\n";

    for (const url of Object.keys(results.resultsByUrl)) {
        const data = results.resultsByUrl[url];
        if (!data.violations) continue;

        for (const v of data.violations) {
            for (const node of v.nodes) {
                const severityClass = mapSeverity(v.impact);
                const severityLabel = SEVERITY_MAP[severityClass]?.label || 'Manual Review Required';
                const row = [
                    "None", // customFlowLabel
                    "Desktop", // deviceChosen
                    results.finishedAt || new Date().toISOString(), // scanCompletedAt
                    severityLabel, // severity
                    v.id, // issueId
                    v.description, // issueDescription
                    v.tags ? v.tags.join(',') : '', // wcagConformance
                    url, // url
                    data.title || '', // pageTitle
                    node.html || '', // context
                    node.failureSummary || '', // howToFix
                    v.impact || '', // axeImpact
                    node.target ? node.target.join(', ') : '', // xpath/selector
                    v.helpUrl || '' // learnMore
                ];
                
                csvContent += row.map(field => escapeCSV(field)).join(",") + "\n";
            }
        }
    }

    const outDir = path.join(SITE_DIR, 'runs', runId);
    fs.writeFileSync(path.join(outDir, 'report.csv'), csvContent);
}

function escapeCSV(field) {
    if (field === null || field === undefined) return '""';
    const stringField = String(field);
    return `"${stringField.replace(/"/g, '""')}"`;
}

function mapSeverity(impact) {
    const mapping = {
        critical: 'critical',
        serious: 'critical',
        moderate: 'moderate',
        minor: 'moderate',
        'review': 'review'
    };
    return mapping[impact] || 'review';
}

function analyzeResults(results) {
    const urls = Object.keys(results.resultsByUrl);
    let mustFixCount = 0;
    let goodToFixCount = 0;
    let reviewCount = 0;
    const pagesWithIssues = new Set();
    let totalNodes = 0;

    for (const url of urls) {
        const data = results.resultsByUrl[url];
        if (!data.violations || !data.violations.length) continue;

        pagesWithIssues.add(url);
        for (const v of data.violations) {
            const nodeCount = (v.nodes || []).length;
            totalNodes += nodeCount;
            const severity = mapSeverity(v.impact);
            if (severity === 'critical') {
                mustFixCount += nodeCount;
            } else if (severity === 'moderate') {
                goodToFixCount += nodeCount;
            } else {
                reviewCount += nodeCount;
            }
        }
    }

    return {
        mustFixCount,
        goodToFixCount,
        reviewCount,
        pagesWithIssues: pagesWithIssues.size,
        automationCoverage: urls.length > 0 ? Math.round((urls.length - (urls.filter(u => results.resultsByUrl[u].error).length)) / urls.length * 100) : 0
    };
}

function getTopPages(results) {
    const pages = {};
    for (const url of Object.keys(results.resultsByUrl)) {
        const data = results.resultsByUrl[url];
        if (!data.violations) continue;
        const nodeCount = data.violations.reduce((sum, v) => sum + (v.nodes?.length || 0), 0);
        if (nodeCount > 0) {
            const maxSeverity = data.violations.reduce((max, v) => {
                const sev = mapSeverity(v.impact);
                return (SEVERITY_MAP[sev]?.order || 999) < (SEVERITY_MAP[max]?.order || 999) ? sev : max;
            }, 'review');
            pages[url] = { count: nodeCount, severity: maxSeverity };
        }
    }
    return Object.entries(pages)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5)
        .map(([url, { count, severity }]) => ({ url, count, severity }));
}

function getIssuesByViolationType(results, severityFilter) {
    const violations = {};
    for (const url of Object.keys(results.resultsByUrl)) {
        const data = results.resultsByUrl[url];
        if (!data.violations) continue;
        for (const v of data.violations) {
            if (mapSeverity(v.impact) !== severityFilter) continue;
            const key = v.id;
            if (!violations[key]) {
                violations[key] = {
                    violationId: v.id,
                    help: v.help || 'N/A',
                    impact: v.impact || 'unknown',
                    helpUrl: v.helpUrl,
                    pages: new Map()
                };
            }
            if (!violations[key].pages.has(url)) {
                violations[key].pages.set(url, { url, nodes: [] });
            }
            violations[key].pages.get(url).nodes.push(...(v.nodes || []));
        }
    }
    return Object.values(violations);
}

function countTotalNodes(groupIssues) {
    return groupIssues.reduce((sum, issue) => {
        return sum + Array.from(issue.pages.values()).reduce((s, page) => s + page.nodes.length, 0);
    }, 0);
}

function renderErrors(results) {
    const entries = Object.entries(results.resultsByUrl || {}).filter(([_, data]) => data?.error);
    if (!entries.length) return '';

    return `
            <div style="margin-top: 1rem;">
                <h4 style="margin-bottom: 0.5rem;">Errors</h4>
                <ul style="padding-left: 1.25rem; line-height: 1.5;">
                    ${entries.map(([url, data]) => `<li><strong>${esc(url)}</strong>: ${esc(data.error)}</li>`).join('')}
                </ul>
            </div>`;
}

function esc(s) {
    if (s === null || s === undefined) return '';
    return String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

export { generateRunPage, generateCSV, analyzeResults, getTopPages, getIssuesByViolationType, countTotalNodes, mapSeverity };
