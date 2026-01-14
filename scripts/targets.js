import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import cronParser from 'cron-parser';
import { sanitizeLabel, buildRunId } from './shared-schema.js';

export { sanitizeLabel, buildRunId } from './shared-schema.js';

const DEFAULT_MAX_PAGES = 50;
const DEFAULT_MODE = 'sitemap';

export function loadTargetsFile(filePath = 'targets.yml') {
  const fullPath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`targets file not found: ${fullPath}`);
  }

  const contents = fs.readFileSync(fullPath, 'utf-8');
  const parsed = YAML.parse(contents, { prettyErrors: true });
  if (!parsed || !Array.isArray(parsed.sites)) {
    throw new Error('targets.yml must contain a top-level "sites" array');
  }

  return parsed.sites.map(normalizeSite);
}

export function sitesDueNow(sites, now = new Date()) {
  return sites.filter(site => isDue(site, now));
}

function normalizeSite(site) {
  if (!site || typeof site !== 'object') {
    throw new Error('Each site entry must be an object');
  }

  const name = site.name;
  if (!name) throw new Error('Each site must have a name');

  const mode = site.mode || DEFAULT_MODE;
  if (!['sitemap', 'crawl', 'list'].includes(mode)) {
    throw new Error(`Invalid mode for ${name}: ${mode}`);
  }

  const maxPages = Number.isFinite(site.maxPages) ? site.maxPages : DEFAULT_MAX_PAGES;

  const urls = Array.isArray(site.urls) ? site.urls : [];
  const schedule = Array.isArray(site.schedule) ? site.schedule : [];
  const label = sanitizeLabel(site.label || name);

  return {
    name,
    baseUrl: site.baseUrl || '',
    mode,
    urls,
    maxPages,
    schedule,
    label,
    notes: site.notes || ''
  };
}

function isDue(site, now) {
  if (!site.schedule || site.schedule.length === 0) return true;
  return site.schedule.some(expr => cronMatches(expr, now));
}

function cronMatches(expr, now) {
  try {
    const windowMs = 60 * 1000;
    const interval = cronParser.parseExpression(expr, {
      currentDate: new Date(now.getTime() - windowMs),
      tz: 'UTC'
    });
    const next = interval.next().toDate();
    return Math.abs(next.getTime() - now.getTime()) <= windowMs;
  } catch (e) {
    console.warn(`Invalid cron expression '${expr}': ${e.message}`);
    return false;
  }
}
