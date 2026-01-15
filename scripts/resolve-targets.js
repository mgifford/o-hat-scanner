import fs from 'fs';
import { loadTargetsFile, sitesDueNow } from './targets.js';

function parseArgs() {
  const args = {
    file: 'targets.yml',
    output: '',
    now: '',
    filter: '',
    respectSchedule: true,
    allowAdhoc: false
  };

  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const val = argv[i];
    switch (val) {
      case '--file':
        args.file = argv[++i];
        break;
      case '--output':
        args.output = argv[++i];
        break;
      case '--now':
        args.now = argv[++i];
        break;
      case '--filter':
        args.filter = argv[++i];
        break;
      case '--ignore-schedule':
        args.respectSchedule = false;
        break;
      case '--allow-adhoc':
        args.allowAdhoc = true;
        break;
      default:
        break;
    }
  }
  return args;
}

export function resolveTargets({ file = 'targets.yml', now = new Date(), filter = '', respectSchedule = true, allowAdhoc = false } = {}) {
  let sites = loadTargetsFile(file);

  if (filter) {
    sites = sites.filter(s => s.name === filter || s.label === filter);
    if (allowAdhoc && sites.length === 0) {
      sites.push({
        name: filter,
        baseUrl: /^https?:\/\//i.test(filter) ? filter : `https://${filter}`,
        mode: 'sitemap',
        maxPages: 50,
        schedule: [],
        label: filter
      });
    }
  }

  if (respectSchedule) {
    sites = sitesDueNow(sites, now);
  }

  return sites;
}

async function main() {
  const args = parseArgs();
  const now = args.now ? new Date(args.now) : new Date();
  const sites = resolveTargets({ file: args.file, now, filter: args.filter, respectSchedule: args.respectSchedule, allowAdhoc: args.allowAdhoc });

  if (args.output) {
    fs.writeFileSync(args.output, JSON.stringify(sites, null, 2));
  }

  console.log(JSON.stringify(sites, null, 2));
}

if (process.env.NODE_ENV !== 'test') {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}