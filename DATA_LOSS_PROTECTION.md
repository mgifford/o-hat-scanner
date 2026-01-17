# Data Loss Protection

## Problem

Previously, if the GitHub Actions workflow ran `generate-report.js` but found no new scans (empty `/site/runs/`), it would **completely overwrite the main index** with an empty report, deleting all existing scan history.

This happened on [run #21088218777](https://github.com/mgifford/o-hat-scanner/actions/runs/21088218777) and caused loss of manually collected scan data.

## Solution

Two complementary protections have been implemented:

### 1. **Option 2: Skip Generation on Empty Scans** (`generate-report.js`)

```javascript
if (!fs.existsSync(RUNS_DIR)) {
    fs.mkdirSync(RUNS_DIR, { recursive: true });
    console.log('No runs found. Skipping report generation to preserve existing data.');
    return;  // Don't generate empty index; keep existing data
}
```

**Effect:** If no new scan results exist, the report generator exits early and **does not touch** the existing `site/index.html` or any other report files.

### 2. **Option 1: Git Backup Before Regeneration** (`.github/workflows/a11y-scan.yml`)

```yaml
- name: Backup site before report generation
  run: |
    set -euo pipefail
    if [ -d site ] && [ -n "$(find site -maxdepth 2 -type f 2>/dev/null)" ]; then
      git add site/ || true
      git commit -m "Backup site/ before report regeneration" || true
    fi
```

**Effect:** Before `generate-report.js` runs, the workflow commits the current `/site/` directory to git. If something goes wrong, you can recover from git history.

**Visibility:** Backup commits show in the repository's commit log and GitHub Pages deployment history.

## Result

- ✅ **No data loss**: Empty scans no longer overwrite reports
- ✅ **Git history**: All site versions are backed up before regeneration
- ✅ **Recovery**: You can `git revert` or `git checkout` previous site versions from git history
- ✅ **Zero overhead**: Backup only commits if files exist and have changed

## Testing the Protection

To manually verify this works:

1. Delete all content from `/site/runs/` (simulate failed scan)
2. Run: `npm run report`
3. Observe: Your `/site/index.html` should **remain unchanged**

No empty reports will be generated.

## Restoring Data from Git

If a backup exists, you can restore a previous version:

```bash
# See backup commits
git log --oneline -- site/

# Restore a specific version
git checkout <commit-hash> -- site/

# Or revert the commit that overwrote it
git revert <problematic-commit-hash>
```
