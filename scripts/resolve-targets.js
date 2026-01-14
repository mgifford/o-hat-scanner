import fs from 'fs';
import { loadTargetsFile, sitesDueNow } from './targets.js';

function parseArgs() {
  const args = {
    file: 'targets.yml',
    output: '',
    now: '',
    filter: '',
    respectSchedule: true
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
      default:
        break;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs();
  const now = args.now ? new Date(args.now) : new Date();
  let sites = loadTargetsFile(args.file);

  if (args.filter) {
    sites = sites.filter(s => s.name === args.filter || s.label === args.filter);
  }

  if (args.respectSchedule) {
    sites = sitesDueNow(sites, now);
  }

  if (args.output) {
    fs.writeFileSync(args.output, JSON.stringify(sites, null, 2));
  }

  console.log(JSON.stringify(sites, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});