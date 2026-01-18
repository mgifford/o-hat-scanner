import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { analyzeResults, buildAggregateRows } from './generate-report.js';

// Configuration
const SITE_DIR = 'site';
const RUNS_DIR = path.join(SITE_DIR, 'runs');
const ARCHIVES_DIR = path.join(SITE_DIR, 'archives');
const KEEP_COUNT = 3;
// Keep latest 3 runs, zip the rest.
// NOTE: Logic mimics the original shell script but adds zipping.

if (!fs.existsSync(RUNS_DIR)) {
    console.log('No runs directory found. Nothing to archive.');
    process.exit(0);
}

if (!fs.existsSync(ARCHIVES_DIR)) {
    fs.mkdirSync(ARCHIVES_DIR, { recursive: true });
}

console.log(`Starting archive process (keeping latest ${KEEP_COUNT} runs per domain)...`);

// Iterate domains
const domains = fs.readdirSync(RUNS_DIR).filter(name => fs.statSync(path.join(RUNS_DIR, name)).isDirectory());

for (const domain of domains) {
    const domainDir = path.join(RUNS_DIR, domain);
    const domainArchiveDir = path.join(ARCHIVES_DIR, domain);
    
    // Get runs (subdirectories), sort by mtime desc (newest first)
    // Note: The original shell script used mtime. We can also use directory name if it's timestamped, 
    // but users might manually name things. We'll trust mtime for now, or stats.birthtime.
    // However, if we restore from cache, mtimes might be reset.
    // Better to check 'startedAt' in results.json? That's expensive.
    // Let's stick to fs.statSync().mtimeMs.
    
    const runs = fs.readdirSync(domainDir)
        .filter(name => fs.statSync(path.join(domainDir, name)).isDirectory())
        .map(name => ({
            name, 
            path: path.join(domainDir, name),
            mtime: fs.statSync(path.join(domainDir, name)).mtimeMs
        }))
        .sort((a, b) => b.mtime - a.mtime); // Newest first

    if (runs.length <= KEEP_COUNT) {
        console.log(`Domain ${domain}: ${runs.length} runs. No archiving needed.`);
        continue;
    }

    // Keep the first KEEP_COUNT
    const toKeep = runs.slice(0, KEEP_COUNT);
    const toArchive = runs.slice(KEEP_COUNT);

    console.log(`Domain ${domain}: keeping ${toKeep.length}, archiving ${toArchive.length} runs.`);
    
    if (!fs.existsSync(domainArchiveDir)) {
        fs.mkdirSync(domainArchiveDir, { recursive: true });
    }

    for (const run of toArchive) {
        try {
            console.log(`  Archiving ${run.name}...`);
            const resultsPath = path.join(run.path, 'results.json');
            const summaryPath = path.join(run.path, 'summary.json');
            
            // 1. Prepare Archive Data (JSON)
            let archiveData = {
                id: run.name,
                domain: domain,
                archivedAt: new Date().toISOString()
            };

            if (fs.existsSync(resultsPath)) {
                const results = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));
                const pageStats = analyzeResults(results);
                const aggregateRows = buildAggregateRows(run.name, results, pageStats);
                
                archiveData.aggregateRows = aggregateRows;

                if (fs.existsSync(summaryPath)) {
                    archiveData.summary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
                } else {
                    // Reconstruct minimal summary if missing?
                    // aggregateRows has 'summary' type metric.
                    // But easier to just skip if missing.
                }
            } else {
                console.warn(`    Warning: results.json missing in ${run.name}. Skipping analytics data.`);
            }

            // Save Archive JSON
            fs.writeFileSync(path.join(domainArchiveDir, `${run.name}.json`), JSON.stringify(archiveData, null, 2));

            // 2. Zip the folder
            const zipPath = path.resolve(domainArchiveDir, `${run.name}.zip`);
            // zip -r dest source

            // We want to zip the *contents* or the folder? 
            // Standard is folder inside zip or flat? 
            // If I unzip, I usually want a folder.
            // Let's zip the folder itself relative to its parent.
            
            try {
                // cd into domainDir and zip the run folder
                execSync(`zip -r -q "${zipPath}" "${run.name}"`, { cwd: domainDir });
                console.log(`    Zipped to ${zipPath}`);
                
                // 3. Delete the original folder
                fs.rmSync(run.path, { recursive: true, force: true });
                console.log(`    Deleted ${run.path}`);
            } catch (err) {
                console.error(`    Failed to zip/delete ${run.name}:`, err.message);
            }

        } catch (e) {
            console.error(`    Error processing ${run.name}:`, e);
        }
    }
}

console.log('Archive process complete.');
