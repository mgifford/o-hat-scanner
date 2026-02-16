#!/usr/bin/env node

/**
 * run-discovery-batch.js
 * Helper script to run discovery on all targets (or filter to discover-mode only).
 * 
 * Usage:
 *   node scripts/run-discovery-batch.js [--discover-only] [--dry-run] [--serp bing|duckduckgo|none]
 * 
 * Examples:
 *   # Run discovery on all discover-mode targets with nav-only
 *   node scripts/run-discovery-batch.js --discover-only
 * 
 *   # Use DuckDuckGo for SERP (no API key needed, respectful rate limiting applied)
 *   node scripts/run-discovery-batch.js --discover-only --serp duckduckgo
 * 
 *   # Test discovery on all targets with nav-only (dry-run)
 *   node scripts/run-discovery-batch.js --dry-run
 * 
 *   # Use Bing with API key
 *   export BING_API_KEY=your-key
 *   node scripts/run-discovery-batch.js --discover-only --serp bing
 */

import { loadTargetsFile } from './targets.js';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs() {
  const args = {
    discoverOnly: false,
    dryRun: false,
    serp: 'none'  // none | bing | duckduckgo
  };

  for (let i = 0; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg === '--discover-only') args.discoverOnly = true;
    if (arg === '--dry-run') args.dryRun = true;
    if (arg === '--serp' && i + 1 < process.argv.length) {
      args.serp = process.argv[i + 1];
      i++;
    }
  }

  return args;
}

function siteKeyFromName(name) {
  return name.replace(/\./g, '-').replace(/\//g, '-').toLowerCase();
}

async function runDiscovery(target, options = {}) {
  return new Promise((resolve, reject) => {
    const {
      dryRun = false,
      serp = 'none',
      outDir = 'site/targets',
      apiKey = process.env.BING_API_KEY || ''
    } = options;

    const siteKey = siteKeyFromName(target.name);
    const baseUrl = target.baseUrl;
    const maxPages = target.maxPages || 100;
    const serpProvider = dryRun ? 'none' : serp;

    const args = [
      'scripts/discover-top-pages.js',
      '--baseUrl', baseUrl,
      '--maxPages', String(maxPages),
      '--outDir', outDir,
      '--siteKey', siteKey,
      '--serpProvider', serpProvider
    ];

    // Add custom queries if defined in target
    if (target.discoveryQueries && Array.isArray(target.discoveryQueries) && target.discoveryQueries.length > 0) {
      args.push('--customQueries');
      args.push(JSON.stringify(target.discoveryQueries));
    }

    console.log(`\n${'='.repeat(70)}`);
    console.log(`🔍 Discovering: ${target.name}`);
    console.log(`   Base URL: ${baseUrl}`);
    console.log(`   Max Pages: ${maxPages}`);
    console.log(`   SERP: ${serpProvider}`);
    if (target.discoveryQueries?.length > 0) console.log(`   Custom Queries: ${target.discoveryQueries.length}`);
    if (dryRun) console.log(`   ⚠️  DRY RUN - nav-only`);
    console.log(`${'='.repeat(70)}\n`);

    const env = { ...process.env, BING_API_KEY: apiKey };
    const proc = spawn('node', args, { env, stdio: 'inherit' });

    proc.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ Completed: ${target.name}\n`);
        resolve();
      } else {
        console.error(`❌ Failed: ${target.name} (exit code ${code})\n`);
        reject(new Error(`Discovery failed for ${target.name}`));
      }
    });

    proc.on('error', reject);
  });
}

async function main() {
  const args = parseArgs();

  console.log('📋 Loading targets from targets.yml...\n');
  let targets = loadTargetsFile('targets.yml');

  if (args.discoverOnly) {
    console.log(`Filtering to discover-mode targets...\n`);
    targets = targets.filter(t => t.mode === 'discover');
  }

  if (targets.length === 0) {
    console.warn('⚠️  No targets found to run discovery on.');
    process.exit(0);
  }

  console.log(`Found ${targets.length} target(s):\n`);
  targets.forEach((t, i) => {
    console.log(`  ${i + 1}. ${t.name} (${t.baseUrl}) - mode: ${t.mode}`);
  });

  const apiKey = process.env.BING_API_KEY || '';
  if (!apiKey && !args.dryRun) {
    console.log(`\n⚠️  No BING_API_KEY set; will use nav-only discovery.`);
    console.log(`   To enable SERP, run: export BING_API_KEY=your-key\n`);
  }

  if (args.dryRun) {
    console.log(`\n🧪 DRY RUN MODE - using nav-only (no SERP)\n`);
  }

  console.log(`\nStarting discovery batch...\n`);

  let completed = 0;
  let failed = 0;

  for (const target of targets) {
    try {
      await runDiscovery(target, {
        dryRun: args.dryRun,
        serp: args.serp,
        apiKey: apiKey
      });
      completed++;
    } catch (err) {
      console.error(`Error: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log(`📊 Batch Complete`);
  console.log(`   Completed: ${completed}/${targets.length}`);
  if (failed > 0) {
    console.log(`   Failed: ${failed}/${targets.length}`);
  }
  console.log(`${'='.repeat(70)}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
