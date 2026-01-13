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
    if (!fs.existsSync(RUNS_DIR)) {
        console.log('No runs found.');
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
    // Sort by date desc
    summaries.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>A11y Scan Reports</title>
    <style>
        body { font-family: system-ui, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; }
        table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
        th, td { text-align: left; padding: 0.5rem; border-bottom: 1px solid #ddd; }
        th { background: #f4f4f4; }
        .status-pass { color: green; }
        .status-fail { color: red; font-weight: bold; }
    </style>
</head>
<body>
    <h1>Accessibility Scan Reports</h1>
    <table>
        <thead>
            <tr>
                <th>Run ID</th>
                <th>Date</th>
                <th>Pages Scanned</th>
                <th>Violations (Pages)</th>
                <th>Total Issues</th>
                <th>Link</th>
            </tr>
        </thead>
        <tbody>
            ${summaries.map(s => `
                <tr>
                    <td>${s.runId}</td>
                    <td>${new Date(s.startedAt).toLocaleString()}</td>
                    <td>${s.pagesScanned}</td>
                    <td>${s.pagesWithViolations}</td>
                    <td class="${s.totalViolations > 0 ? 'status-fail' : 'status-pass'}">${s.totalViolations}</td>
                    <td><a href="runs/${s.runId}/index.html">View Report</a></td>
                </tr>
            `).join('')}
        </tbody>
    </table>
</body>
</html>`;

    fs.writeFileSync(path.join(SITE_DIR, 'index.html'), html);
    console.log('Generated main index.');
}

function generateRunPage(runId, results, pageStats) {
    const urls = Object.keys(results.resultsByUrl);
    const { mustFixCount, goodToFixCount, reviewCount, pagesWithIssues, automationCoverage } = pageStats;
    const totalIssues = mustFixCount + goodToFixCount + reviewCount;
    const topPages = getTopPages(results);
    const runDate = results.startedAt ? new Date(results.startedAt) : new Date();
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const primaryTarget = (results.targets && results.targets[0]) || urls[0] || 'N/A';
    const runDir = path.join(SITE_DIR, 'runs', runId);
    fs.mkdirSync(runDir, { recursive: true });

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Scan Report: ${esc(runId)}</title>
    <style>
        * { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background: #f5f5f5; color: #222; }
        a { color: #1976d2; text-decoration: none; }
        a:hover { text-decoration: underline; }
        h1, h2, h3, h4 { margin: 0; }

        header { background: linear-gradient(135deg, #0d47a1 0%, #1976d2 100%); color: #fff; padding: 2rem 1rem; }
        .header-content { max-width: 1200px; margin: 0 auto; }
        .back-link { color: #bbdefb; font-size: 14px; display: inline-block; margin-bottom: 0.75rem; }
        .back-link:hover { color: #fff; }
        h1 { font-size: 28px; font-weight: 700; }
        .meta { margin-top: 0.5rem; font-size: 14px; color: #e3f2fd; }
        .meta strong { color: #fff; }
        .download-link { display: inline-block; margin-top: 1rem; padding: 10px 16px; background: #fff; color: #0d47a1; border-radius: 4px; font-weight: 600; }
        .download-link:hover { background: #e3f2fd; text-decoration: none; }

        .container { max-width: 1200px; margin: -40px auto 0 auto; padding: 0 1rem 2rem 1rem; }
        .layout { display: grid; grid-template-columns: 2fr 0.9fr; gap: 1.5rem; align-items: start; }
        @media (max-width: 960px) { .layout { grid-template-columns: 1fr; } }

        .panel { background: #fff; border: 1px solid #e0e0e0; border-radius: 6px; box-shadow: 0 6px 18px rgba(0,0,0,0.04); padding: 1.5rem; }
        .panel + .panel { margin-top: 1rem; }
        .panel h3 { font-size: 16px; font-weight: 700; color: #111; margin-bottom: 0.75rem; }
        .panel small { color: #666; }

        .search-row { display: flex; gap: 0.75rem; margin-bottom: 1rem; flex-wrap: wrap; }
        .search-input { flex: 1 1 260px; padding: 10px 12px; border: 1px solid #ccd7e1; border-radius: 4px; font-size: 14px; }
        .search-input:focus { outline: 2px solid #90caf9; border-color: #90caf9; }

        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 1rem; }
        .card { background: #fafafa; border: 1px solid #e0e0e0; border-radius: 6px; padding: 1rem; }
        .card h4 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #666; margin-bottom: 0.35rem; }
        .card .value { font-size: 30px; font-weight: 700; }
        .card.critical .value { color: #d32f2f; }
        .card.warning .value { color: #f57c00; }
        .card.info .value { color: #1976d2; }
        .card .subtext { font-size: 12px; color: #666; margin-top: 4px; }

        .bar { background: #e0e0e0; height: 22px; border-radius: 4px; overflow: hidden; display: flex; margin: 10px 0; }
        .bar-segment { height: 100%; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: 700; }
        .bar-auto { background: #1976d2; }

        .top-pages { display: grid; gap: 0.5rem; }
        .page-row { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; border: 1px solid #e6e6e6; border-radius: 4px; }
        .page-row .url { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size: 13px; overflow-wrap: anywhere; }
        .pill { background: #e3f2fd; color: #0d47a1; padding: 4px 10px; border-radius: 999px; font-weight: 700; font-size: 12px; white-space: nowrap; }

        .issues-by-severity { margin-top: 1.5rem; }
        .severity-group { border: 1px solid #e0e0e0; border-radius: 6px; overflow: hidden; margin-bottom: 1rem; }
        .severity-header { background: #f7f9fc; padding: 1rem; display: flex; justify-content: space-between; align-items: center; cursor: pointer; }
        .severity-header .title { font-weight: 700; }
        .severity-header .count { background: #e0e0e0; padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: 700; }
        .severity-content { padding: 1rem; }

        .violation-item { border-bottom: 1px solid #f0f0f0; padding: 0.75rem 0; }
        .violation-item:last-child { border-bottom: none; }
        .violation-id { font-weight: 700; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; color: #111; }
        .violation-help { color: #555; margin: 4px 0 6px 0; }
        .violation-meta { font-size: 12px; color: #777; margin-bottom: 8px; }
        .node-list { background: #fafafa; border: 1px solid #e6e6e6; border-radius: 4px; padding: 10px; font-size: 13px; }
        .node-item { margin-bottom: 8px; }
        .node-item:last-child { margin-bottom: 0; }
        .node-url { font-weight: 700; }
        .node-selector { color: #1976d2; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
        .node-html { margin-top: 4px; color: #555; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; overflow-wrap: anywhere; }

        .pill-critical { background: #ffebee; color: #c62828; }
        .pill-warning { background: #fff3e0; color: #ef6c00; }
        .pill-info { background: #e3f2fd; color: #1565c0; }
    </style>
</head>
<body>
    <header>
        <div class="header-content">
            <a href="../../index.html" class="back-link">← Back to all runs</a>
            <h1>Accessibility Scan Report</h1>
            <p class="meta">
                <strong>Scan ID:</strong> ${esc(runId)} · <strong>Date:</strong> ${runDate.toLocaleString()} · <strong>Mode:</strong> ${esc(results.mode || 'unknown')}
            </p>
            <a href="report.csv" class="download-link" download>Download CSV</a>
        </div>
    </header>

    <div class="container">
        <div class="layout">
            <!-- Main column -->
            <div class="panel">
                <div class="search-row">
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
                                <div class="url">${esc(url)}</div>
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
                            <div class="severity-header">
                                <span class="title">${label}</span>
                                <span class="count ${pillClass}">${total} occurrences</span>
                            </div>
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
                                                    <div class="node-url">${esc(url)} (${nodes.length} node${nodes.length !== 1 ? 's' : ''})</div>
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
                <div style="margin-bottom: 0.25rem;">Viewport: Desktop</div>
                <div style="margin-bottom: 0.25rem;">Mode: ${esc(results.mode || 'ci')}</div>
                <div style="margin-top: 0.5rem;">Pages crawled: ${urls.length}</div>
                <div>Total occurrences: ${totalIssues}</div>
            </div>
        </div>
    </div>

    <script>
        // Toggle severity blocks
        document.querySelectorAll('.severity-header').forEach(header => {
            header.addEventListener('click', () => {
                const content = header.nextElementSibling;
                content.style.display = content.style.display === 'none' ? 'block' : 'none';
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

function esc(s) {
    if (s === null || s === undefined) return '';
    return String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

export { generateRunPage, generateCSV, analyzeResults, getTopPages, getIssuesByViolationType, countTotalNodes, mapSeverity };
