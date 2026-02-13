import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(__dirname, '..');

const SITE_DIR = 'site';
const RUNS_DIR = path.join(SITE_DIR, 'runs');
const ARCHIVES_DIR = path.join(SITE_DIR, 'archives');
const MAX_INDEX_RUNS_PER_DOMAIN = 3;

function ensureDirSync(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function formatRunIdShort(runId = '') {
    const safe = runId || '';
    if (!safe) return 'n/a';
    if (safe.length <= 28) return safe;
    return `${safe.slice(0, 18)}…${safe.slice(-12)}`;
}

function collectRunEntries() {
    const entries = [];
    
    // Collect active runs
    if (fs.existsSync(RUNS_DIR)) {
        const levelOne = fs.readdirSync(RUNS_DIR).filter(name => fs.statSync(path.join(RUNS_DIR, name)).isDirectory());
        for (const dir of levelOne) {
            const directResults = path.join(RUNS_DIR, dir, 'results.json');
            if (fs.existsSync(directResults)) {
                entries.push({ runId: dir, runRelPath: dir, isArchived: false });
                continue;
            }
            const sub = fs.readdirSync(path.join(RUNS_DIR, dir)).filter(name => fs.statSync(path.join(RUNS_DIR, dir, name)).isDirectory());
            for (const s of sub) {
                const resultsPath = path.join(RUNS_DIR, dir, s, 'results.json');
                if (fs.existsSync(resultsPath)) {
                    entries.push({ runId: s, runRelPath: path.join(dir, s), isArchived: false });
                }
            }
        }
    }

    // Collect archived runs
    if (fs.existsSync(ARCHIVES_DIR)) {
        const levelOne = fs.readdirSync(ARCHIVES_DIR).filter(name => fs.statSync(path.join(ARCHIVES_DIR, name)).isDirectory());
        for (const dir of levelOne) {
            const sub = fs.readdirSync(path.join(ARCHIVES_DIR, dir)).filter(name => name.endsWith('.json'));
            for (const s of sub) {
                // e.g. runId.json
                const runId = s.replace('.json', '');
                entries.push({ runId, runRelPath: path.join(dir, s), isArchived: true });
            }
        }
    }

    return entries;
}

// Severity levels based on axe impact
const SEVERITY_MAP = {
    critical: { label: 'Must Fix', order: 1, color: '#d32f2f' },
    serious: { label: 'Must Fix', order: 1, color: '#d32f2f' },
    moderate: { label: 'Good to Fix', order: 2, color: '#f57c00' },
    minor: { label: 'Good to Fix', order: 2, color: '#f57c00' },
    'review': { label: 'Manual Review Required', order: 3, color: '#1976d2' }
};

function copyStaticFiles() {
    if (fs.existsSync('static/404.html')) {
        fs.copyFileSync('static/404.html', path.join(SITE_DIR, '404.html'));
        console.log('Copied static/404.html to site/404.html.');
    }
}

function generateMainIndex(summaries) {
    const normalizeTarget = (t = '') => t.replace(/^https?:\/\//i, '').replace(/^www\./i, '').toLowerCase();
    const sortedSummaries = [...summaries].sort((a, b) => {
        const dateDiff = new Date(b.startedAt) - new Date(a.startedAt);
        if (dateDiff !== 0) return dateDiff;
        const ta = normalizeTarget(a.target || '');
        const tb = normalizeTarget(b.target || '');
        if (ta < tb) return -1;
        if (ta > tb) return 1;
        return 0;
    });

    const perDomainCounts = new Map();
    const filteredSummaries = [];
    for (const s of sortedSummaries) {
        const key = normalizeTarget(s.target || '');
        const count = perDomainCounts.get(key) || 0;
        if (count >= MAX_INDEX_RUNS_PER_DOMAIN) continue;
        perDomainCounts.set(key, count + 1);
        filteredSummaries.push(s);
    }
    const html = `<!DOCTYPE html>
<html lang="en" class="light-theme">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>O-Hat Scanner - Accessibility Reports</title>
    <style>
        * { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background: #f5f5f5; color: #222; }
        a { color: #1976d2; text-decoration: underline; }
        a:hover { text-decoration: underline; }
        header { background: #0a2540; color: #fff; padding: 3rem 1rem; }
        .header-content { max-width: 1200px; margin: 0 auto; }
        h1 { font-size: 32px; font-weight: 700; margin: 0 0 0.5rem 0; color: #fff; }
        .tagline { font-size: 18px; color: #fff; margin: 0; }
        main { max-width: 1200px; margin: 2rem auto; padding: 0 1rem; }
        .intro { background: #fff; padding: 2rem; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 2rem; }
        .intro h2 { margin-top: 0; color: #0d47a1; }
        .intro p { line-height: 1.6; margin: 1rem 0; }
        .features { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; margin: 2rem 0; }
        .feature { background: #fff; padding: 1.5rem; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .feature h3 { color: #0d47a1; margin-top: 0; }
        .feature p { margin: 0.5rem 0; line-height: 1.5; }
        .reports-section { background: #fff; padding: 2rem; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin: 2rem 0; }
        .reports-section h2 { color: #0d47a1; margin-top: 0; }
        .report-filters { display: flex; gap: 1rem; align-items: center; margin-top: 0.5rem; flex-wrap: wrap; }
        .filter-label { font-weight: 600; color: #333; }
        .filter-select { padding: 0.45rem 0.6rem; border: 1px solid #ddd; border-radius: 4px; min-width: 180px; }
        .table-wrapper { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; margin-top: 1rem; min-width: 760px; table-layout: auto; }
        th, td { text-align: left; padding: 0.75rem; border-bottom: 1px solid #ddd; vertical-align: top; }
        th { background: #f4f4f4; font-weight: 600; white-space: nowrap; }
        .report-cell, .viewport-cell, .color-cell, .browser-cell, .pages-cell, .total-cell { white-space: nowrap; }
        .date-cell { white-space: normal; max-width: 160px; }
        .date-cell .date-date { font-weight: 600; }
        .date-cell .date-time { color: #555; }
        .target-cell { min-width: 220px; }
        .sort-btn { background: transparent; border: none; font: inherit; color: #0d47a1; cursor: pointer; padding: 0; }
        .sort-btn:focus { outline: 2px solid #0d47a1; outline-offset: 2px; }
        .status-pass { color: green; }
        .status-fail { color: red; font-weight: bold; }
        .target-cell { display: flex; flex-direction: column; gap: 4px; }
        .target-main { font-weight: 700; }
        .target-meta { font-size: 12px; color: #555; display: inline-flex; gap: 6px; align-items: baseline; }
        .run-id { position: relative; font-family: ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace; color: #505050; opacity: 0.8; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: inline-block; vertical-align: bottom; }
        tr:hover .run-id, tr:focus-within .run-id { opacity: 1; }
        .run-id:focus { outline: 2px solid #5e35b1; outline-offset: 2px; }
        .run-id::after { content: attr(data-full); display: none; position: absolute; left: 0; top: calc(100% + 4px); z-index: 10; background: #111; color: #fff; padding: 6px 8px; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.3); white-space: normal; max-width: 60vw; min-width: 240px; }
        .run-id:hover::after, .run-id:focus::after { display: block; }
        .options-cell { white-space: normal; font-size: 12px; color: #333; }
        .options-badge { display: inline-block; padding: 2px 6px; border: 1px solid #ddd; border-radius: 999px; margin-right: 6px; margin-bottom: 4px; background: #fafafa; }
        @media (max-width: 900px) {
            th.viewport-col, td.viewport-cell,
            th.color-col, td.color-cell,
            th.browser-col, td.browser-cell { display: none; }
            th.options-col, td.options-cell { display: table-cell; }
        }
        @media (min-width: 901px) {
            th.options-col, td.options-cell { display: none; }
        }
        .view-link { display: inline-block; padding: 8px 12px; background: #0d47a1; color: #fff; border-radius: 4px; font-weight: 700; border: 1px solid #0d47a1; text-align: center; text-decoration: none; }
        .view-link:hover { background: #0b3a82; color: #fff; text-decoration: none; }
        .view-link:focus { outline: 2px solid #5e35b1; outline-offset: 3px; }
        footer { text-align: center; padding: 2rem 1rem; color: #666; font-size: 14px; }
        footer a { color: #0d47a1; text-decoration: underline; }
        footer a:hover { color: #1976d2; }
    </style>
</head>
<body>
    <header>
        <div class="header-content">
            <h1>🎩 O-Hat Scanner</h1>
            <p class="tagline">Oobee-style accessibility reports powered by GitHub Actions & Pages</p>
            <p style="margin-top: 1rem;"><a href="https://github.com/mgifford/o-hat-scanner" style="color: #fff; font-weight: 600; text-decoration: underline;">View on GitHub →</a></p>
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
            ${filteredSummaries.length === 0 ? '<p>No scan reports yet. Check back after the first scan completes.</p>' : `
            <div class="report-filters">
                <div class="filter-label">Showing:</div>
                <select id="archiveFilter" class="filter-select" aria-label="Show runs">
                    <option value="active" selected>Active only</option>
                    <option value="archived">Archived only</option>
                    <option value="all">All runs</option>
                </select>
            </div>
            <p>View detailed accessibility reports from recent scans:</p>
            <div class="table-wrapper">
            <table aria-live="polite">
                <thead>
                    <tr>
                        <th><button class="sort-btn" data-sort="report">View</button></th>
                        <th><button class="sort-btn" data-sort="target">Target</button></th>
                        <th class="viewport-col"><button class="sort-btn" data-sort="viewport">Viewport</button></th>
                        <th class="color-col"><button class="sort-btn" data-sort="colorScheme">Color</button></th>
                        <th class="browser-col"><button class="sort-btn" data-sort="browser">Browser</button></th>
                        <th class="options-col" scope="col">Options</th>
                        <th><button class="sort-btn" data-sort="pagesScanned">Pages</button></th>
                        <th><button class="sort-btn" data-sort="totalViolations">Errors</button></th>
                        <th><button class="sort-btn" data-sort="startedAt">Date</button></th>
                    </tr>
                </thead>
                <tbody>
                    ${filteredSummaries.map((s, i) => {
                        const startedIso = s.startedAt || '';
                        const runShort = formatRunIdShort(s.runId || '');
                        const relPath = s.runRelPath || s.runId;
                        const isArchived = !!s.isArchived;
                        const linkUrl = isArchived && s.archivePath ? s.archivePath : `runs/${esc(relPath)}/index.html`;
                        const linkLabel = isArchived ? `Download archive for ${s.target || 'run'}` : `Open ${s.target || 'report'}`;
                        const linkText = isArchived ? 'Download ZIP' : 'Open';
                        return `
                        <tr data-started-at="${esc(s.startedAt || '')}" data-target="${esc(s.target || '')}" data-viewport="${esc(s.viewport || '')}" data-color-scheme="${esc(s.colorScheme || '')}" data-browser="${esc(s.browser || '')}" data-pages="${s.pagesScanned ?? ''}" data-total="${s.totalViolations ?? ''}" data-idx="${i}" data-archived="${isArchived}">
                            <td class="report-cell"><a class="view-link" href="${esc(linkUrl)}" aria-label="${esc(linkLabel)}">${linkText}</a></td>
                            <td>
                                <div class="target-cell">
                                    <div class="target-main">${esc(s.target || 'Unknown')}</div>
                                    <div class="target-meta">Run ID <span tabindex="0" class="run-id" title="${esc(s.runId || '')}" aria-label="Run ID ${esc(s.runId || '')}" data-full="${esc(s.runId || '')}">${esc(runShort)}</span>${isArchived ? ' (Archived)' : ''}</div>
                                </div>
                            </td>
                            <td class="viewport-cell">${esc(s.viewport || 'desktop')}</td>
                            <td class="color-cell">${esc(s.colorScheme || 'light')}</td>
                            <td class="browser-cell">${esc(s.browser || 'chromium')}</td>
                            <td class="options-cell">
                                <span class="options-badge">${esc(s.viewport || 'desktop')}</span>
                                <span class="options-badge">${esc(s.colorScheme || 'light')}</span>
                                <span class="options-badge">${esc(s.browser || 'chromium')}</span>
                            </td>
                            <td class="pages-cell">${s.pagesScanned ?? '—'}</td>
                            <td class="total-cell ${(s.totalViolations || 0) > 0 ? 'status-fail' : 'status-pass'}">${s.totalViolations ?? 0}</td>
                            <td class="date-cell" data-started-at="${esc(s.startedAt || '')}"><div class="date-date"></div><div class="date-time"></div></td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
            </div>
            `}
        </div>
        
        <div class="intro" id="standalone">
            <h2>📦 Related Project: O-Hat Standalone Scanner</h2>
            <p>Need same-origin browser-based scanning? Check out the <strong><a href="https://github.com/mgifford/o-hat-standalone">O-Hat Standalone Scanner</a></strong>—a companion project that runs accessibility scans directly in your browser.</p>
            <p><strong>Features:</strong></p>
            <ul>
                <li>Single HTML file—no server required</li>
                <li>Discovers pages via sitemap.xml</li>
                <li>Real-time progress tracking</li>
                <li>JSON + CSV export with Oobee-compatible schema</li>
                <li>Token-based access control</li>
            </ul>
            <p><strong>Try it:</strong> <a href="https://mgifford.github.io/o-hat-standalone/">Live demo</a> | <a href="https://github.com/mgifford/o-hat-standalone">GitHub repository</a></p>
        </div>
        
        <div class="intro">
            <h2>📈 Trends & History</h2>
            <p>Track accessibility improvements over time with the <a href="trends.html"><strong>Trends Dashboard</strong></a>.</p>
            <p>View violation counts across multiple scans, filter by target/viewport/browser, and export historical data.</p>
        </div>
    </main>
    
    <footer>
        <p>O-Hat Scanner | <a href="https://github.com/mgifford/o-hat-scanner">GitHub</a> | Built with <a href="https://github.com/dequelabs/axe-core">axe-core</a></p>
    </footer>

    <script>
        const tbody = document.querySelector('tbody');
        const sortButtons = document.querySelectorAll('.sort-btn');
        const archiveFilter = document.getElementById('archiveFilter');
        let sortState = { key: 'startedAt', dir: 'desc' };

        function formatDate(cell) {
            const iso = cell.dataset.startedAt || '';
            const dateEl = cell.querySelector('.date-date');
            const timeEl = cell.querySelector('.date-time');
            if (!iso) {
                if (dateEl) dateEl.textContent = 'N/A';
                if (timeEl) timeEl.textContent = '';
                else cell.textContent = 'N/A';
                return;
            }
            const dt = new Date(iso);
            const dateStr = dt.toLocaleDateString('en-CA'); // YYYY-MM-DD
            const timeStr = dt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true, timeZoneName: 'short' });
            if (dateEl && timeEl) {
                dateEl.textContent = dateStr;
                timeEl.textContent = timeStr;
            } else {
                cell.textContent = dateStr + ' ' + timeStr;
            }
        }

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
            applyArchiveFilter();
        }

        function updateSortIndicators() {
            sortButtons.forEach(btn => {
                const th = btn.parentElement;
                const dir = btn.dataset.sort === sortState.key ? (sortState.dir === 'asc' ? 'ascending' : 'descending') : 'none';
                th.setAttribute('aria-sort', dir);
            });
        }

        function applyArchiveFilter() {
            if (!archiveFilter) return;
            const mode = archiveFilter.value;
            const rows = Array.from(tbody.querySelectorAll('tr'));
            rows.forEach(row => {
                const isArchived = row.dataset.archived === 'true';
                const show = mode === 'all' || (mode === 'archived' && isArchived) || (mode === 'active' && !isArchived);
                row.style.display = show ? '' : 'none';
            });
        }

        sortButtons.forEach(btn => {
            btn.addEventListener('click', () => applySort(btn.dataset.sort));
        });

        if (archiveFilter) {
            archiveFilter.addEventListener('change', applyArchiveFilter);
            applyArchiveFilter();
        }

        document.querySelectorAll('.date-cell').forEach(formatDate);

        updateSortIndicators();
    </script>
</body>
</html>`;

    fs.writeFileSync(path.join(SITE_DIR, 'index.html'), html);
    console.log('Generated main index.');
}

function renderRunPage(runId, runRelPath, results, stats) {
    const {
        pagesScanned,
        pagesWithViolations,
        totalViolations,
        critical,
        serious,
        moderate,
        minor
    } = stats;

    const runDir = path.join(ROOT, 'site', 'runs', runRelPath);
    ensureDirSync(runDir);

    const html = `
<!DOCTYPE html>
<html lang="en" class="light-theme">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>O-Hat Scanner - Accessibility Reports</title>
    <style>
        * { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background: #f5f5f5; color: #222; }
        a { color: #1976d2; text-decoration: underline; }
        a:hover { text-decoration: underline; }
        header { background: #0a2540; color: #fff; padding: 3rem 1rem; }
        .header-content { max-width: 1200px; margin: 0 auto; }
        h1 { font-size: 32px; font-weight: 700; margin: 0 0 0.5rem 0; color: #fff; }
        .tagline { font-size: 18px; color: #fff; margin: 0; }
        main { max-width: 1200px; margin: 2rem auto; padding: 0 1rem; }
        .intro { background: #fff; padding: 2rem; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 2rem; }
        .intro h2 { margin-top: 0; color: #0d47a1; }
        .intro p { line-height: 1.6; margin: 1rem 0; }
        .features { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; margin: 2rem 0; }
        .feature { background: #fff; padding: 1.5rem; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .feature h3 { color: #0d47a1; margin-top: 0; }
        .feature p { margin: 0.5rem 0; line-height: 1.5; }
        .reports-section { background: #fff; padding: 2rem; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin: 2rem 0; }
        .reports-section h2 { color: #0d47a1; margin-top: 0; }
        .report-filters { display: flex; gap: 1rem; align-items: center; margin-top: 0.5rem; flex-wrap: wrap; }
        .filter-label { font-weight: 600; color: #333; }
        .filter-select { padding: 0.45rem 0.6rem; border: 1px solid #ddd; border-radius: 4px; min-width: 180px; }
        .table-wrapper { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; margin-top: 1rem; min-width: 760px; table-layout: auto; }
        th, td { text-align: left; padding: 0.75rem; border-bottom: 1px solid #ddd; vertical-align: top; }
        th { background: #f4f4f4; font-weight: 600; white-space: nowrap; }
        .report-cell, .viewport-cell, .color-cell, .browser-cell, .pages-cell, .total-cell { white-space: nowrap; }
        .date-cell { white-space: normal; max-width: 160px; }
        .date-cell .date-date { font-weight: 600; }
        .date-cell .date-time { color: #555; }
        .target-cell { min-width: 220px; }
        .sort-btn { background: transparent; border: none; font: inherit; color: #0d47a1; cursor: pointer; padding: 0; }
        .sort-btn:focus { outline: 2px solid #0d47a1; outline-offset: 2px; }
        .status-pass { color: green; }
        .status-fail { color: red; font-weight: bold; }
        .target-cell { display: flex; flex-direction: column; gap: 4px; }
        .target-main { font-weight: 700; }
        .target-meta { font-size: 12px; color: #555; display: inline-flex; gap: 6px; align-items: baseline; }
        .run-id { position: relative; font-family: ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace; color: #505050; opacity: 0.8; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: inline-block; vertical-align: bottom; }
        tr:hover .run-id, tr:focus-within .run-id { opacity: 1; }
        .run-id:focus { outline: 2px solid #5e35b1; outline-offset: 2px; }
        .run-id::after { content: attr(data-full); display: none; position: absolute; left: 0; top: calc(100% + 4px); z-index: 10; background: #111; color: #fff; padding: 6px 8px; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.3); white-space: normal; max-width: 60vw; min-width: 240px; }
        .run-id:hover::after, .run-id:focus::after { display: block; }
        .options-cell { white-space: normal; font-size: 12px; color: #333; }
        .options-badge { display: inline-block; padding: 2px 6px; border: 1px solid #ddd; border-radius: 999px; margin-right: 6px; margin-bottom: 4px; background: #fafafa; }
        @media (max-width: 900px) {
            th.viewport-col, td.viewport-cell,
            th.color-col, td.color-cell,
            th.browser-col, td.browser-cell { display: none; }
            th.options-col, td.options-cell { display: table-cell; }
        }
        @media (min-width: 901px) {
            th.options-col, td.options-cell { display: none; }
        }
        .view-link { display: inline-block; padding: 8px 12px; background: #0d47a1; color: #fff; border-radius: 4px; font-weight: 700; border: 1px solid #0d47a1; text-align: center; text-decoration: none; }
        .view-link:hover { background: #0b3a82; color: #fff; text-decoration: none; }
        .view-link:focus { outline: 2px solid #5e35b1; outline-offset: 3px; }
        footer { text-align: center; padding: 2rem 1rem; color: #666; font-size: 14px; }
        footer a { color: #0d47a1; text-decoration: underline; }
        footer a:hover { color: #1976d2; }
    </style>
</head>
<body>
    <header>
        <div class="header-content">
            <h1>🎩 O-Hat Scanner</h1>
            <p class="tagline">Oobee-style accessibility reports powered by GitHub Actions & Pages</p>
            <p style="margin-top: 1rem;"><a href="https://github.com/mgifford/o-hat-scanner" style="color: #fff; font-weight: 600; text-decoration: underline;">View on GitHub →</a></p>
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
            ${filteredSummaries.length === 0 ? '<p>No scan reports yet. Check back after the first scan completes.</p>' : `
            <div class="report-filters">
                <div class="filter-label">Showing:</div>
                <select id="archiveFilter" class="filter-select" aria-label="Show runs">
                    <option value="active" selected>Active only</option>
                    <option value="archived">Archived only</option>
                    <option value="all">All runs</option>
                </select>
            </div>
            <p>View detailed accessibility reports from recent scans:</p>
            <div class="table-wrapper">
            <table aria-live="polite">
                <thead>
                    <tr>
                        <th><button class="sort-btn" data-sort="report">View</button></th>
                        <th><button class="sort-btn" data-sort="target">Target</button></th>
                        <th class="viewport-col"><button class="sort-btn" data-sort="viewport">Viewport</button></th>
                        <th class="color-col"><button class="sort-btn" data-sort="colorScheme">Color</button></th>
                        <th class="browser-col"><button class="sort-btn" data-sort="browser">Browser</button></th>
                        <th class="options-col" scope="col">Options</th>
                        <th><button class="sort-btn" data-sort="pagesScanned">Pages</button></th>
                        <th><button class="sort-btn" data-sort="totalViolations">Errors</button></th>
                        <th><button class="sort-btn" data-sort="startedAt">Date</button></th>
                    </tr>
                </thead>
                <tbody>
                    ${filteredSummaries.map((s, i) => {
                        const startedIso = s.startedAt || '';
                        const runShort = formatRunIdShort(s.runId || '');
                        const relPath = s.runRelPath || s.runId;
                        const isArchived = !!s.isArchived;
                        const linkUrl = isArchived && s.archivePath ? s.archivePath : `runs/${esc(relPath)}/index.html`;
                        const linkLabel = isArchived ? `Download archive for ${s.target || 'run'}` : `Open ${s.target || 'report'}`;
                        const linkText = isArchived ? 'Download ZIP' : 'Open';
                        return `
                        <tr data-started-at="${esc(s.startedAt || '')}" data-target="${esc(s.target || '')}" data-viewport="${esc(s.viewport || '')}" data-color-scheme="${esc(s.colorScheme || '')}" data-browser="${esc(s.browser || '')}" data-pages="${s.pagesScanned ?? ''}" data-total="${s.totalViolations ?? ''}" data-idx="${i}" data-archived="${isArchived}">
                            <td class="report-cell"><a class="view-link" href="${esc(linkUrl)}" aria-label="${esc(linkLabel)}">${linkText}</a></td>
                            <td>
                                <div class="target-cell">
                                    <div class="target-main">${esc(s.target || 'Unknown')}</div>
                                    <div class="target-meta">Run ID <span tabindex="0" class="run-id" title="${esc(s.runId || '')}" aria-label="Run ID ${esc(s.runId || '')}" data-full="${esc(s.runId || '')}">${esc(runShort)}</span>${isArchived ? ' (Archived)' : ''}</div>
                                </div>
                            </td>
                            <td class="viewport-cell">${esc(s.viewport || 'desktop')}</td>
                            <td class="color-cell">${esc(s.colorScheme || 'light')}</td>
                            <td class="browser-cell">${esc(s.browser || 'chromium')}</td>
                            <td class="options-cell">
                                <span class="options-badge">${esc(s.viewport || 'desktop')}</span>
                                <span class="options-badge">${esc(s.colorScheme || 'light')}</span>
                                <span class="options-badge">${esc(s.browser || 'chromium')}</span>
                            </td>
                            <td class="pages-cell">${s.pagesScanned ?? '—'}</td>
                            <td class="total-cell ${(s.totalViolations || 0) > 0 ? 'status-fail' : 'status-pass'}">${s.totalViolations ?? 0}</td>
                            <td class="date-cell" data-started-at="${esc(s.startedAt || '')}"><div class="date-date"></div><div class="date-time"></div></td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
            </div>
            `}
        </div>
        
        <div class="intro" id="standalone">
            <h2>📦 Related Project: O-Hat Standalone Scanner</h2>
            <p>Need same-origin browser-based scanning? Check out the <strong><a href="https://github.com/mgifford/o-hat-standalone">O-Hat Standalone Scanner</a></strong>—a companion project that runs accessibility scans directly in your browser.</p>
            <p><strong>Features:</strong></p>
            <ul>
                <li>Single HTML file—no server required</li>
                <li>Discovers pages via sitemap.xml</li>
                <li>Real-time progress tracking</li>
                <li>JSON + CSV export with Oobee-compatible schema</li>
                <li>Token-based access control</li>
            </ul>
            <p><strong>Try it:</strong> <a href="https://mgifford.github.io/o-hat-standalone/">Live demo</a> | <a href="https://github.com/mgifford/o-hat-standalone">GitHub repository</a></p>
        </div>
        
        <div class="intro">
            <h2>📈 Trends & History</h2>
            <p>Track accessibility improvements over time with the <a href="trends.html"><strong>Trends Dashboard</strong></a>.</p>
            <p>View violation counts across multiple scans, filter by target/viewport/browser, and export historical data.</p>
        </div>
    </main>
    
    <footer>
        <p>O-Hat Scanner | <a href="https://github.com/mgifford/o-hat-scanner">GitHub</a> | Built with <a href="https://github.com/dequelabs/axe-core">axe-core</a></p>
    </footer>

    <script>
        const tbody = document.querySelector('tbody');
        const sortButtons = document.querySelectorAll('.sort-btn');
        const archiveFilter = document.getElementById('archiveFilter');
        let sortState = { key: 'startedAt', dir: 'desc' };

        function formatDate(cell) {
            const iso = cell.dataset.startedAt || '';
            const dateEl = cell.querySelector('.date-date');
            const timeEl = cell.querySelector('.date-time');
            if (!iso) {
                if (dateEl) dateEl.textContent = 'N/A';
                if (timeEl) timeEl.textContent = '';
                else cell.textContent = 'N/A';
                return;
            }
            const dt = new Date(iso);
            const dateStr = dt.toLocaleDateString('en-CA'); // YYYY-MM-DD
            const timeStr = dt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true, timeZoneName: 'short' });
            if (dateEl && timeEl) {
                dateEl.textContent = dateStr;
                timeEl.textContent = timeStr;
            } else {
                cell.textContent = dateStr + ' ' + timeStr;
            }
        }

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
            applyArchiveFilter();
        }

        function updateSortIndicators() {
            sortButtons.forEach(btn => {
                const th = btn.parentElement;
                const dir = btn.dataset.sort === sortState.key ? (sortState.dir === 'asc' ? 'ascending' : 'descending') : 'none';
                th.setAttribute('aria-sort', dir);
            });
        }

        function applyArchiveFilter() {
            if (!archiveFilter) return;
            const mode = archiveFilter.value;
            const rows = Array.from(tbody.querySelectorAll('tr'));
            rows.forEach(row => {
                const isArchived = row.dataset.archived === 'true';
                const show = mode === 'all' || (mode === 'archived' && isArchived) || (mode === 'active' && !isArchived);
                row.style.display = show ? '' : 'none';
            });
        }

        sortButtons.forEach(btn => {
            btn.addEventListener('click', () => applySort(btn.dataset.sort));
        });

        if (archiveFilter) {
            archiveFilter.addEventListener('change', applyArchiveFilter);
            applyArchiveFilter();
        }

        document.querySelectorAll('.date-cell').forEach(formatDate);

        updateSortIndicators();
    </script>
</body>
</html>`;

    fs.writeFileSync(path.join(SITE_DIR, 'index.html'), html);
    console.log('Generated main index.');
}

function generateRunPage(runId, runRelPath, results, stats) {
    const runDir = path.join(ROOT, 'site', 'runs', runRelPath);
    ensureDirSync(runDir);

    const html = renderRunPage(runId, runRelPath, results, stats);

    fs.writeFileSync(path.join(runDir, 'index.html'), html);
    // Provide a build-time MHTML-like artifact by duplicating the HTML; downstream can save/distribute easily.
    fs.writeFileSync(path.join(runDir, 'report.mhtml'), html);
}

function generateCSV(runId, runRelPath, results) {
    const headers = getOobeeHeaders();
    const rows = [headers];
    const scanCompletedAt = formatInTimeZone(new Date(results.startedAt), 'America/New_York', 'yyyy-MM-dd HH:mm:ss zzz');

    for (const url of Object.keys(results.resultsByUrl)) {
        const data = results.resultsByUrl[url];
        if (!data.violations) continue;

        for (const v of data.violations) {
            const severity = mapSeverity(v.impact);
            const wcag = (v.tags || []).filter(t => t.startsWith('wcag')).join(', ');

            for (const node of v.nodes) {
                const row = {
                    customFlowLabel: results.runId,
                    deviceChosen: results.config?.browser || 'n/a',
                    scanCompletedAt,
                    severity,
                    issueId: v.id,
                    issueDescription: v.help,
                    wcagConformance: wcag,
                    url,
                    pageTitle: data.title || '',
                    context: node.html,
                    howToFix: node.failureSummary || v.help,
                    axeImpact: v.impact,
                    xpath: node.target.join(', '),
                    learnMore: v.helpUrl
                };
                rows.push(headers.map(h => row[h]));
            }
        }
    }
    return rows.map(row => row.join(',')).join('\n');
}

function aggregateMetrics(results, pageStats) {
    const counts = {
        total: 0,
        byImpact: { critical: 0, serious: 0, moderate: 0, minor: 0 },
        rules: new Map(),
        wcag: new Map()
    };

    for (const url of Object.keys(results.resultsByUrl)) {
        const data = results.resultsByUrl[url];
        if (!data.violations) continue;
        for (const v of data.violations) {
            const nodes = v.nodes || [];
            const nodeCount = nodes.length;
            counts.total += nodeCount;
            const impact = (v.impact || '').toLowerCase();
            if (impact && counts.byImpact[impact] !== undefined) {
                counts.byImpact[impact] += nodeCount;
            }
            counts.rules.set(v.id, (counts.rules.get(v.id) || 0) + nodeCount);
            (v.tags || []).forEach(tag => {
                const t = (tag || '').toLowerCase();
                if (t.startsWith('wcag')) {
                    counts.wcag.set(t, (counts.wcag.get(t) || 0) + nodeCount);
                }
            });
        }
    }

    return {
        pagesScanned: pageStats.pagesScanned,
        pagesWithIssues: pageStats.pagesWithIssues,
        automationCoverage: pageStats.automationCoverage,
        ...counts
    };
}

function buildAggregateRows(runId, results, pageStats) {
    const metrics = aggregateMetrics(results, pageStats);
    const cfg = results.config || {};
    const base = {
        runId,
        startedAt: results.startedAt || '',
        target: (results.targets && results.targets[0]) || cfg.baseUrl || '',
        viewport: cfg.viewport || 'desktop',
        colorScheme: cfg.colorScheme || 'light',
        browser: (cfg.browser || 'chromium').toLowerCase(),
        pagesScanned: metrics.pagesScanned,
        totalViolations: metrics.total,
        critical: metrics.byImpact.critical,
        serious: metrics.byImpact.serious,
        moderate: metrics.byImpact.moderate,
        minor: metrics.byImpact.minor
    };

    const rows = [];
    rows.push({ ...base, metricType: 'summary', metricId: 'overall', metricCount: metrics.total });
    metrics.rules.forEach((count, id) => {
        rows.push({ ...base, metricType: 'rule', metricId: id, metricCount: count });
    });
    metrics.wcag.forEach((count, id) => {
        rows.push({ ...base, metricType: 'wcag', metricId: id, metricCount: count });
    });
    return rows;
}

function generateAggregateCsv(rows) {
    const headers = [
        'runId','startedAt','target','viewport','colorScheme','browser','pagesScanned','totalViolations','critical','serious','moderate','minor','metricType','metricId','metricCount'
    ];
    let csv = headers.join(',') + '\n';
    for (const r of rows) {
        csv += [
            r.runId,
            r.startedAt,
            r.target,
            r.viewport,
            r.colorScheme,
            r.browser,
            r.pagesScanned,
            r.totalViolations,
            r.critical,
            r.serious,
            r.moderate,
            r.minor,
            r.metricType,
            r.metricId,
            r.metricCount
        ].map(s => String(s ?? '').replace(/"/g, '""')).join(',') + '\n';
    }
    fs.writeFileSync(path.join(SITE_DIR, 'aggregate.csv'), csv);
}

function generateTrendsPage() {
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>O-Hat Trends</title>
    <style>
        :root { color-scheme: light; --bg:#f5f5f5; --panel:#fff; --border:#e0e0e0; --text:#222; --muted:#666; --link:#1976d2; --accent:#0a2540; --grid:#ccc; --line:#1976d2; --dot:#0d47a1; }
        body { margin:0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif; background:var(--bg); color:var(--text); }
        header { padding:1rem; background:var(--accent); color:#fff; }
        h1 { margin:0; font-size:24px; color:#fff; }
        main { max-width:1100px; margin:1.5rem auto; padding:0 1rem 2rem; }
        .panel { background:var(--panel); border:1px solid var(--border); border-radius:6px; padding:1rem; box-shadow:0 2px 8px rgba(0,0,0,0.04); }
        .controls { display:flex; flex-wrap:wrap; gap:0.75rem; margin-bottom:1rem; align-items:flex-end; }
        label { font-weight:600; font-size:14px; color:var(--text); }
        select { padding:8px; border:1px solid var(--border); border-radius:4px; min-width:180px; }
        canvas, svg { width:100%; height:360px; border:1px solid var(--border); border-radius:4px; background:#fff; }
        .legend { display:flex; gap:1rem; flex-wrap:wrap; margin-top:0.5rem; font-size:13px; color:var(--muted); }
        .legend span { display:inline-flex; align-items:center; gap:6px; }
        .swatch { width:12px; height:12px; border-radius:50%; background:var(--line); display:inline-block; }
        table { width:100%; border-collapse:collapse; margin-top:1rem; font-size:13px; }
        th, td { padding:8px; border-bottom:1px solid var(--border); text-align:left; }
        th { background:#fafafa; }
        .status { margin:0.5rem 0; color:#222; font-size:14px; }
        #status { color:#fff; }
        .sr-only { position:absolute; left:-9999px; }
        button:focus, select:focus { outline:2px solid var(--line); outline-offset:2px; }
    </style>
</head>
<body>
    <a class="sr-only" href="#main">Skip to main content</a>
    <header>
        <h1>O-Hat Trends</h1>
        <p style="margin:0.5rem 0;"><a href="index.html" style="color:#fff;text-decoration:underline;">← Back to Reports</a></p>
        <p aria-live="polite" class="status" id="status">Loading aggregate data…</p>
    </header>
    <main id="main">
        <div class="panel">
            <div class="controls">
                <div>
                    <label for="targetSelect">Target</label><br>
                    <select id="targetSelect" aria-label="Target"></select>
                </div>
                <div>
                    <label for="metricSelect">Metric</label><br>
                    <select id="metricSelect" aria-label="Metric">
                        <option value="totalViolations">Total violations</option>
                        <option value="critical">Critical</option>
                        <option value="serious">Serious</option>
                        <option value="moderate">Moderate</option>
                        <option value="minor">Minor</option>
                    </select>
                </div>
                <div>
                    <label for="filterViewport">Viewport</label><br>
                    <select id="filterViewport" aria-label="Viewport filter">
                        <option value="">All</option>
                        <option value="desktop">Desktop</option>
                        <option value="mobile">Mobile</option>
                    </select>
                </div>
                <div>
                    <label for="filterColor">Color scheme</label><br>
                    <select id="filterColor" aria-label="Color scheme filter">
                        <option value="">All</option>
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                    </select>
                </div>
                <div>
                    <label for="filterBrowser">Browser</label><br>
                    <select id="filterBrowser" aria-label="Browser filter">
                        <option value="">All</option>
                        <option value="chromium">Chromium</option>
                        <option value="firefox">Firefox</option>
                        <option value="webkit">WebKit</option>
                    </select>
                </div>
            </div>
            <svg id="chart" role="img" aria-label="Trends line chart" viewBox="0 0 100 40" preserveAspectRatio="none"></svg>
            <div class="legend" id="legend"></div>
            <div class="status" id="summary"></div>
            <table aria-label="Data table" id="dataTable">
                <thead><tr><th scope="col">Date</th><th scope="col">Run</th><th scope="col">Pages</th><th scope="col">Total</th><th scope="col">Critical</th><th scope="col">Serious</th><th scope="col">Moderate</th><th scope="col">Minor</th></tr></thead>
                <tbody><tr><td colspan="8" aria-live="polite">No data yet</td></tr></tbody>
            </table>
        </div>
    </main>
    <script>
        const statusEl = document.getElementById('status');
        const targetSelect = document.getElementById('targetSelect');
        const metricSelect = document.getElementById('metricSelect');
        const filterViewport = document.getElementById('filterViewport');
        const filterColor = document.getElementById('filterColor');
        const filterBrowser = document.getElementById('filterBrowser');
        const chart = document.getElementById('chart');
        const legendEl = document.getElementById('legend');
        const summaryEl = document.getElementById('summary');
        const tbody = document.querySelector('#dataTable tbody');

        const palette = ['#1976d2','#d32f2f','#f57c00','#388e3c','#6a1b9a','#00796b','#c2185b','#455a64'];
        const newlineRe = new RegExp('\\r?\\n');

        function parseCsv(text) {
            const lines = text.trim().split(newlineRe);
            const headers = lines.shift().split(',');
            return lines.map(line => {
                const cells = line.split(',');
                const obj = {};
                headers.forEach((h, i) => obj[h] = cells[i]);
                return obj;
            });
        }

        function groupByTarget(rows) {
            const byTarget = new Map();
            rows.filter(r => r.metricType === 'summary').forEach(r => {
                const key = r.target || 'unknown';
                if (!byTarget.has(key)) byTarget.set(key, []);
                byTarget.get(key).push(r);
            });
            byTarget.forEach(list => list.sort((a,b) => new Date(a.startedAt) - new Date(b.startedAt)));
            return byTarget;
        }

        function drawSeries(seriesList, metricKey) {
            chart.innerHTML = '';
            legendEl.innerHTML = '';
            if (!seriesList.length) return;

            const maxVal = Math.max(...seriesList.flatMap(s => s.points.map(p => p.val)), 1);

            seriesList.forEach((series, idx) => {
                const color = series.color || palette[idx % palette.length];
                const coords = series.points.map(p => {
                    const y = 40 - ((p.val/maxVal)*35) - 2;
                    return { ...p, y };
                });
                const poly = document.createElementNS('http://www.w3.org/2000/svg','polyline');
                poly.setAttribute('fill','none');
                poly.setAttribute('stroke', color);
                poly.setAttribute('stroke-width','1.2');
                poly.setAttribute('points', coords.map(p => (p.x + ',' + p.y)).join(' '));
                chart.appendChild(poly);

                coords.forEach(p => {
                    const c = document.createElementNS('http://www.w3.org/2000/svg','circle');
                    c.setAttribute('cx', p.x);
                    c.setAttribute('cy', p.y);
                    c.setAttribute('r', 1.2);
                    c.setAttribute('fill', color);
                    chart.appendChild(c);
                });

                const badge = document.createElement('span');
                badge.innerHTML = '<span class="swatch" style="background:' + color + ';"></span>' + series.name;
                legendEl.appendChild(badge);
            });
        }

        function populateTable(data) {
            tbody.innerHTML = data.map(d => {
                return '<tr>' +
                    '<td>' + new Date(d.startedAt).toLocaleString() + '</td>' +
                    '<td>' + d.runId + '</td>' +
                    '<td>' + d.pagesScanned + '</td>' +
                    '<td>' + d.totalViolations + '</td>' +
                    '<td>' + d.critical + '</td>' +
                    '<td>' + d.serious + '</td>' +
                    '<td>' + d.moderate + '</td>' +
                    '<td>' + d.minor + '</td>' +
                '</tr>';
            }).join('');
        }

        function buildSeries(filtered, metricKey, targetFilter) {
            if (targetFilter) {
                const pts = filtered.sort((a,b) => new Date(a.startedAt) - new Date(b.startedAt)).map((d,i,arr) => {
                    const x = (i/(arr.length-1||1))*100;
                    const val = Number(d[metricKey] || 0);
                    return { x, runId:d.runId, startedAt:d.startedAt, val };
                });
                return [{ name: targetFilter, points: pts }];
            }

            // Multi-series: one per target plus total
            const byTarget = new Map();
            filtered.forEach(r => {
                const key = r.target || 'unknown';
                if (!byTarget.has(key)) byTarget.set(key, []);
                byTarget.get(key).push(r);
            });

            const series = Array.from(byTarget.entries()).map(([key, list], idx) => {
                const sorted = list.sort((a,b) => new Date(a.startedAt) - new Date(b.startedAt));
                const points = sorted.map((d,i) => {
                    const x = (i/(sorted.length-1||1))*100;
                    const val = Number(d[metricKey] || 0);
                    return { x, runId:d.runId, startedAt:d.startedAt, val };
                });
                return { name: key, points, color: palette[idx % palette.length] };
            });

            // Total series across targets by timestamp
            const totalsByDate = new Map();
            filtered.forEach(r => {
                const key = r.startedAt;
                const val = Number(r[metricKey] || 0);
                const prev = totalsByDate.get(key) || { startedAt: r.startedAt, val: 0 };
                prev.val += val;
                totalsByDate.set(key, prev);
            });
            const totals = Array.from(totalsByDate.values()).sort((a,b) => new Date(a.startedAt) - new Date(b.startedAt));
            const totalPoints = totals.map((t,i) => {
                const x = (i/(totals.length-1||1))*100;
                return { x, runId:'total', startedAt:t.startedAt, val:t.val };
            });
            series.push({ name: 'Total', points: totalPoints, color: '#111' });
            return series;
        }

        function updateView(rows) {
            const target = targetSelect.value;
            const metric = metricSelect.value;
            const vp = filterViewport.value;
            const cs = filterColor.value;
            const br = filterBrowser.value;
            const filtered = rows
                .filter(r => r.metricType === 'summary')
                .filter(r => !target || r.target === target)
                .filter(r => !vp || r.viewport === vp)
                .filter(r => !cs || r.colorScheme === cs)
                .filter(r => !br || r.browser === br);
            const series = buildSeries(filtered, metric, target);
            drawSeries(series, metric);
            populateTable(filtered);
            summaryEl.textContent = filtered.length ? (filtered.length + ' runs shown for ' + (target || 'all targets') + '.') : 'No runs match the filters.';
        }

        async function init() {
            try {
                const resp = await fetch('aggregate.csv');
                if (!resp.ok) throw new Error('aggregate.csv not found');
                const text = await resp.text();
                const rows = parseCsv(text);
                const targets = Array.from(new Set(rows.filter(r => r.metricType === 'summary').map(r => r.target || 'unknown'))).sort();
                targetSelect.innerHTML = '<option value="">All targets</option>' + targets.map(t => '<option value="' + t + '">' + t + '</option>').join('');
                [targetSelect, metricSelect, filterViewport, filterColor, filterBrowser].forEach(el => el.addEventListener('change', () => updateView(rows)));
                statusEl.textContent = 'Data loaded. Adjust filters to view trends.';
                updateView(rows);
            } catch (e) {
                statusEl.textContent = 'Failed to load aggregate.csv';
                summaryEl.textContent = e.message;
            }
        }
        init();
    </script>
</body>
</html>`;
        fs.writeFileSync(path.join(SITE_DIR, 'trends.html'), html);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main();
}


function escapeCSV(field) {
    if (field === null || field === undefined) return '""';
    const stringField = String(field);
    return `"${stringField.replace(/"/g, '""')}"`;
}

function mapSeverity(impact) {
    return SEVERITY_MAP[impact] || 'Manual Review Required';
}

function getOobeeHeaders() {
    return [
        'customFlowLabel', 'deviceChosen', 'scanCompletedAt', 'severity', 'issueId',
        'issueDescription', 'wcagConformance', 'url', 'pageTitle', 'context',
        'howToFix', 'axeImpact', 'xpath', 'learnMore'
    ];
}

function generateCsv(results) {
    const headers = getOobeeHeaders();
    const rows = [headers];
    const scanCompletedAt = formatInTimeZone(new Date(results.startedAt), 'America/New_York', 'yyyy-MM-dd HH:mm:ss zzz');

    for (const url of Object.keys(results.resultsByUrl)) {
        const data = results.resultsByUrl[url];
        if (!data.violations) continue;

        for (const v of data.violations) {
            const severity = mapSeverity(v.impact);
            const wcag = (v.tags || []).filter(t => t.startsWith('wcag')).join(', ');

            for (const node of v.nodes) {
                const row = {
                    customFlowLabel: results.runId,
                    deviceChosen: results.config?.browser || 'n/a',
                    scanCompletedAt,
                    severity,
                    issueId: v.id,
                    issueDescription: v.help,
                    wcagConformance: wcag,
                    url,
                    pageTitle: data.title || '',
                    context: node.html,
                    howToFix: node.failureSummary || v.help,
                    axeImpact: v.impact,
                    xpath: node.target.join(', '),
                    learnMore: v.helpUrl
                };
                rows.push(headers.map(h => row[h]));
            }
        }
    }
    return rows.map(row => row.join(',')).join('\n');
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

export {
    formatRunIdShort,
    collectRunEntries,
    generateMainIndex,
    generateRunPage,
    generateCsv,
    analyzeResults,
    renderRunPage
};
