import fs from 'fs';
import path from 'path';

const SITE_DIR = 'site';
const RUNS_DIR = path.join(SITE_DIR, 'runs');

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
            generateRunPage(runId, results); // creates site/runs/<id>/index.html
            
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

function generateRunPage(runId, results) {
    const urls = Object.keys(results.resultsByUrl);
    
    // Process stats
    const totalViolations = urls.reduce((acc, url) => {
        const r = results.resultsByUrl[url];
        return acc + (r.violations ? r.violations.reduce((sum, v) => sum + v.nodes.length, 0) : 0);
    }, 0);

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Run ${runId}</title>
    <style>
        body { font-family: system-ui, sans-serif; max-width: 1200px; margin: 2rem auto; padding: 0 1rem; }
        header { border-bottom: 1px solid #ccc; padding-bottom: 1rem; margin-bottom: 2rem; }
        .summary-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; }
        .card { padding: 1rem; background: #f9f9f9; border-radius: 4px; border: 1px solid #eee; }
        .card h3 { margin: 0 0 0.5rem 0; font-size: 0.9rem; color: #666; }
        .card .value { font-size: 1.5rem; font-weight: bold; }
        .fail { color: #d32f2f; }
        
        details { margin: 0.5rem 0; border: 1px solid #eee; border-radius: 4px; }
        summary { padding: 0.5rem; cursor: pointer; background: #f4f4f4; font-weight: bold; }
        .details-body { padding: 1rem; }
        
        .url-row { margin-bottom: 2rem; border-top: 2px solid #333; padding-top: 1rem; }
        .violation-group { margin-left: 1rem; border-left: 2px solid #ddd; padding-left: 1rem; margin-bottom: 1rem; }
        code { background: #eee; padding: 0.2rem 0.4rem; border-radius: 3px; font-size: 0.9em; }
        pre { background: #333; color: #fff; padding: 0.5rem; border-radius: 4px; overflow-x: auto; }
    </style>
</head>
<body>
    <header>
        <a href="../../index.html">&larr; Back to all runs</a>
        <h1>Scan Results: ${runId}</h1>
        <p>Started: ${new Date(results.startedAt).toLocaleString()} | Mode: ${results.mode}</p>
    </header>

    <div class="summary-cards">
        <div class="card">
            <h3>Pages Scanned</h3>
            <div class="value">${urls.length}</div>
        </div>
        <div class="card">
            <h3>Total Violations</h3>
            <div class="value ${totalViolations > 0 ? 'fail' : ''}">${totalViolations}</div>
        </div>
    </div>

    <h2>Details by URL</h2>
    ${urls.map(url => {
        const data = results.resultsByUrl[url];
        const violationCount = data.violations ? data.violations.reduce((sum, v) => sum + v.nodes.length, 0) : 0;
        
        if (data.error) {
            return `<div class="url-row">
                <h3>${url} <span class="fail">(Error)</span></h3>
                <p>${data.error}</p>
            </div>`;
        }

        if (violationCount === 0) return ''; // Skip clean pages in detail view or make optional

        return `<div class="url-row">
            <h3>${url} <span class="fail">(${violationCount} issues)</span></h3>
            ${data.violations.map(v => `
                <details>
                    <summary>${v.id}: ${v.help} (${v.nodes.length})</summary>
                    <div class="details-body">
                        <p><strong>Impact:</strong> ${v.impact}</p>
                        <p><strong>Description:</strong> ${v.description}</p>
                        <p><a href="${v.helpUrl}" target="_blank">More info</a></p>
                        ${v.nodes.map(node => `
                            <div class="violation-group">
                                <p>Target: <code>${node.target.join(', ')}</code></p>
                                <pre>${node.html.replace(/</g, '&lt;')}</pre>
                                <p>${node.failureSummary}</p>
                            </div>
                        `).join('')}
                    </div>
                </details>
            `).join('')}
        </div>`;
    }).join('')}
    
    ${urls.every(u => !results.resultsByUrl[u].violations?.length) ? '<p>No violations found!</p>' : ''}

</body>
</html>`;

    const outDir = path.join(SITE_DIR, 'runs', runId);
    fs.writeFileSync(path.join(outDir, 'index.html'), html);
}

main();
