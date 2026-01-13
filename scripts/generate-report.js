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

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Scan Report: ${runId}</title>
    <style>
        * { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background: #f5f5f5; }
        header { background: #fff; border-bottom: 1px solid #e0e0e0; padding: 2rem 1rem; margin-bottom: 2rem; }
        .header-content { max-width: 1200px; margin: 0 auto; }
        .back-link { color: #1976d2; text-decoration: none; font-size: 14px; display: inline-block; margin-bottom: 1rem; }
        .back-link:hover { text-decoration: underline; }
        h1 { margin: 0.5rem 0 0 0; font-size: 28px; }
        .meta { color: #666; font-size: 14px; margin: 0.5rem 0 0 0; }

        .container { max-width: 1200px; margin: 0 auto; padding: 0 1rem 2rem 1rem; }
        
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
        .card { background: #fff; border: 1px solid #e0e0e0; border-radius: 4px; padding: 1.5rem; }
        .card h3 { margin: 0 0 0.5rem 0; font-size: 12px; font-weight: 600; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
        .card .value { font-size: 32px; font-weight: bold; margin: 0; }
        .card.critical .value { color: #d32f2f; }
        .card.warning .value { color: #f57c00; }
        .card.info .value { color: #1976d2; }

        .compliance-section { background: #fff; border: 1px solid #e0e0e0; border-radius: 4px; padding: 1.5rem; margin-bottom: 2rem; }
        .compliance-section h3 { margin: 0 0 1rem 0; font-size: 16px; font-weight: 600; }
        .bar { background: #e0e0e0; height: 24px; border-radius: 4px; overflow: hidden; display: flex; }
        .bar-segment { height: 100%; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: bold; }
        .bar-pass { background: #4caf50; }
        .bar-auto { background: #1976d2; }

        .issues-section { background: #fff; border: 1px solid #e0e0e0; border-radius: 4px; padding: 1.5rem; margin-bottom: 2rem; }
        .issues-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-top: 1rem; }
        .issue-box { padding: 1rem; border: 1px solid #e0e0e0; border-radius: 4px; text-align: center; cursor: pointer; transition: all 0.2s; }
        .issue-box:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .issue-box .count { font-size: 28px; font-weight: bold; margin-bottom: 0.5rem; }
        .issue-box .label { font-size: 14px; color: #666; }
        .issue-must-fix .count { color: #d32f2f; }
        .issue-good-to-fix .count { color: #f57c00; }
        .issue-review .count { color: #1976d2; }

        .pages-section { background: #fff; border: 1px solid #e0e0e0; border-radius: 4px; padding: 1.5rem; margin-bottom: 2rem; }
        .pages-section h3 { margin: 0 0 1rem 0; font-size: 16px; font-weight: 600; }
        .page-item { padding: 1rem; border-bottom: 1px solid #f0f0f0; display: flex; justify-content: space-between; align-items: center; }
        .page-item:last-child { border-bottom: none; }
        .page-url { flex: 1; font-family: monospace; font-size: 13px; word-break: break-all; }
        .page-badge { background: #f0f0f0; padding: 4px 8px; border-radius: 3px; font-size: 12px; font-weight: 600; margin-left: 1rem; white-space: nowrap; }
        .badge-critical { background: #ffebee; color: #d32f2f; }
        .badge-warning { background: #fff3e0; color: #f57c00; }
        .badge-info { background: #e3f2fd; color: #1976d2; }

        .details-section { background: #fff; border: 1px solid #e0e0e0; border-radius: 4px; overflow: hidden; margin-bottom: 2rem; }
        .issues-by-severity { margin-bottom: 0; }
        .severity-group { border-bottom: 1px solid #e0e0e0; }
        .severity-group:last-child { border-bottom: none; }
        .severity-header { padding: 1.5rem; background: #fafafa; border-bottom: 1px solid #e0e0e0; cursor: pointer; user-select: none; display: flex; justify-content: space-between; align-items: center; font-weight: 600; }
        .severity-header:hover { background: #f5f5f5; }
        .severity-header .count { background: #e0e0e0; padding: 2px 8px; border-radius: 12px; font-size: 12px; margin-left: 1rem; }
        .severity-content { padding: 1.5rem; }
        .violation-item { margin-bottom: 1.5rem; padding-bottom: 1.5rem; border-bottom: 1px solid #f0f0f0; }
        .violation-item:last-child { border-bottom: none; }
        .violation-id { font-weight: 600; font-family: monospace; color: #333; }
        .violation-help { color: #666; margin: 0.5rem 0; }
        .violation-impact { font-size: 12px; color: #999; margin-top: 0.5rem; }
        .node-list { margin-top: 1rem; background: #f9f9f9; padding: 1rem; border-radius: 4px; font-size: 13px; }
        .node-item { margin-bottom: 0.5rem; }
        .node-selector { font-family: monospace; color: #1976d2; }
        .node-html { font-family: monospace; color: #666; margin-top: 0.25rem; padding: 0.5rem; background: #fff; border-radius: 2px; overflow-x: auto; max-height: 100px; }

        .no-violations { padding: 2rem; text-align: center; color: #666; }

        a { color: #1976d2; text-decoration: none; }
        a:hover { text-decoration: underline; }

        .download-link { display: inline-block; margin: 1rem 0; padding: 8px 16px; background: #1976d2; color: white; border-radius: 4px; text-decoration: none; }
        .download-link:hover { background: #1565c0; text-decoration: none; }
    </style>
</head>
<body>
    <header>
        <div class="header-content">
            <a href="../../index.html" class="back-link">← Back to all runs</a>
            <h1>Accessibility Scan Report</h1>
            <p class="meta">
                <strong>Scan ID:</strong> ${runId} |
                <strong>Date:</strong> ${new Date(results.startedAt).toLocaleString()} |
                <strong>Mode:</strong> ${results.mode}
            </p>
            <a href="report.csv" class="download-link" download>Download CSV Report</a>
        </div>
    </header>

    <div class="container">
        <!-- Summary Cards -->
        <div class="summary-grid">
            <div class="card">
                <h3>Pages Scanned</h3>
                <p class="value">${urls.length}</p>
            </div>
            <div class="card">
                <h3>Pages with Issues</h3>
                <p class="value">${pagesWithIssues}</p>
            </div>
            <div class="card critical">
                <h3>Must Fix</h3>
                <p class="value">${mustFixCount}</p>
            </div>
            <div class="card warning">
                <h3>Good to Fix</h3>
                <p class="value">${goodToFixCount}</p>
            </div>
            <div class="card info">
                <h3>Manual Review</h3>
                <p class="value">${reviewCount}</p>
            </div>
        </div>

        <!-- Issues Summary Box -->
        <div class="issues-section">
            <h3>Issue Categories</h3>
            <div class="issues-grid">
                <div class="issue-box issue-must-fix">
                    <div class="count">${mustFixCount}</div>
                    <div class="label">Must Fix</div>
                </div>
                <div class="issue-box issue-good-to-fix">
                    <div class="count">${goodToFixCount}</div>
                    <div class="label">Good to Fix</div>
                </div>
                <div class="issue-box issue-review">
                    <div class="count">${reviewCount}</div>
                    <div class="label">Manual Review</div>
                </div>
            </div>
        </div>

        <!-- Top Affected Pages -->
        ${pagesWithIssues > 0 ? `
        <div class="pages-section">
            <h3>Top Pages with Issues</h3>
            ${getTopPages(results).map(({ url, count, severity }) => `
                <div class="page-item">
                    <div class="page-url">${esc(url)}</div>
                    <span class="page-badge ${severity === 'critical' ? 'badge-critical' : severity === 'warning' ? 'badge-warning' : 'badge-info'}">${count} issues</span>
                </div>
            `).join('')}
        </div>
        ` : ''}

        <!-- Issues by Severity -->
        <div class="details-section issues-by-severity">
            ${['critical', 'moderate', 'review'].map(severity => {
                const label = SEVERITY_MAP[severity]?.label || severity;
                const groupIssues = getIssuesByViolationType(results, severity);
                if (groupIssues.length === 0) return '';
                
                return `
                <div class="severity-group">
                    <div class="severity-header">
                        <span>${label}</span>
                        <span class="count">${countTotalNodes(groupIssues)} issues</span>
                    </div>
                    <div class="severity-content">
                        ${groupIssues.map(({ violationId, help, impact, helpUrl, pages }) => `
                            <div class="violation-item">
                                <div class="violation-id">${esc(violationId)}</div>
                                <div class="violation-help">${esc(help)}</div>
                                <div class="violation-impact">Impact: ${esc(impact)} | Affected pages: ${pages.size}</div>
                                ${helpUrl ? `<div><a href="${esc(helpUrl)}" target="_blank" rel="noopener">Learn more</a></div>` : ''}
                                <div class="node-list">
                                    ${[...pages.values()].slice(0, 3).map(({ url, nodes }) => `
                                        <div class="node-item">
                                            <div><strong>${esc(url)}</strong> (${nodes.length} node${nodes.length !== 1 ? 's' : ''})</div>
                                            ${nodes.slice(0, 1).map(node => `
                                                <div class="node-selector">Selector: ${esc(node.target?.join(', ') || 'N/A')}</div>
                                                ${node.html ? `<div class="node-html">${esc(node.html.substring(0, 150))}</div>` : ''}
                                            `).join('')}
                                        </div>
                                    `).join('')}
                                    ${pages.size > 3 ? `<div class="node-item">... and ${pages.size - 3} more page${pages.size - 3 !== 1 ? 's' : ''}</div>` : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                `;
            }).join('')}
            ${mustFixCount + goodToFixCount + reviewCount === 0 ? '<div class="no-violations"><p>✓ No accessibility issues found!</p></div>' : ''}
        </div>
    </div>

    <script>
        document.querySelectorAll('.severity-header').forEach(header => {
            header.addEventListener('click', () => {
                const content = header.nextElementSibling;
                content.style.display = content.style.display === 'none' ? 'block' : 'none';
            });
        });
    </script>
</body>
</html>`;

    const outDir = path.join(SITE_DIR, 'runs', runId);
    fs.writeFileSync(path.join(outDir, 'index.html'), html);
}

main();

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
