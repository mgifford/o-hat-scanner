## Summary

Scan results today live only in static HTML/CSV reports. There is no closed-loop tracking of whether discovered violations are ever fixed. By using GitHub Accessibility Agents to automatically create, update, and close GitHub Issues, the project can create an accountability workflow that bridges discovery and remediation.

## Problem

- Violations are found during scans but there is no mechanism to track whether they are ever fixed.
- Teams operating the scanned sites receive no notifications about new violations.
- When a violation disappears in a later scan it is unclear if it was fixed or if sampling variance caused it to be missed.
- Site owners have no single place to monitor their accessibility debt over time.

## Proposed Solution

Add a new script `scripts/sync-violation-issues.js` powered by the GitHub Accessibility Agent workflow:

### Behavior

1. **After each scan**, compare `resultsByUrl` in the new run with the most recent prior run for the same domain.
2. **For each new violation rule** (first time seen on that domain): open a GitHub Issue with:
   - Title: `[a11y] <rule-id> on <domain> – <wcag-criterion>`
   - Labels: `accessibility`, `<impact-level>` (e.g. `critical`), `automated`
   - Body: Top 5 affected pages, violation description, WCAG link, link to full report.
3. **On subsequent scans**: comment on the existing Issue with updated page counts and trend data (improving / worsening / stable).
4. **When a violation rule drops to zero instances** on that domain: automatically close the Issue with a "Resolved" comment linking to the confirming scan.

### Example Issue Created

```
Title: [a11y] color-contrast on va.gov – WCAG 1.4.3 Contrast (Minimum)
Labels: accessibility, serious, automated

Detected in scan: 2025-07-01T06:00:00Z
Affected pages: 23 / 50 scanned
Top pages:
  - https://www.va.gov/health-care/ (12 instances)
  - https://www.va.gov/disability/ (8 instances)
  ...
Rule: color-contrast
WCAG: 1.4.3 AA – Contrast (Minimum)
Full report: https://mgifford.github.io/o-hat-scanner/runs/2025-07-01T060000Z--va-weekly/
```

## Benefits

- Creates a persistent, searchable record of each site's accessibility debt.
- Enables site owners to subscribe to issue notifications.
- Automatically closes issues when regressions are resolved (no manual cleanup).
- Leverages the GitHub Accessibility Agent's understanding of WCAG semantics to enrich issue content.
- Complements (does not replace) static HTML reports.

## Acceptance Criteria

- [ ] `sync-violation-issues.js` compares current and prior scan results per domain.
- [ ] New violation rules create Issues with correct labels and structured body.
- [ ] Recurring violations add a comment with updated counts to the existing Issue.
- [ ] Resolved violations close the Issue automatically with a comment.
- [ ] No duplicate Issues are created for the same rule+domain combination.
- [ ] Script is invoked as an optional step in `.github/workflows/a11y-scan.yml`.
- [ ] Tests cover the diff logic, Issue creation payload, and close conditions.

## References

- [Getting Started with Accessibility Agents](https://accessibility.github.com/documentation/guide/getting-started-with-agents/)
- `scripts/shared-schema.js` – result schema to diff against
- `site/aggregate.csv` – historical data source for trend comparison
- `scripts/archive-old-runs.js` – prior-run resolution pattern
