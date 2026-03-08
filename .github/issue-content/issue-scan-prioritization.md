## Summary

The current scanner samples pages from sitemaps using shuffle or sequential strategies without any knowledge of which pages historically have the most violations. GitHub Accessibility Agents can analyze `aggregate.csv` and per-run JSON results to intelligently weight page selection toward high-impact content, maximizing the value of each capped scan.

## Problem

- `targets.yml` defines static `maxPages` limits (default 50). With large government sitemaps (100k+ URLs), page sampling is essentially random.
- High-violation pages may be consistently missed while low-risk pages consume the quota.
- When sites add or restructure content, the scanner has no signal to re-prioritize.
- The `discover` mode uses Bing queries but has no feedback loop from prior violation data to refine what it searches for.

## Proposed Solution

Introduce an **agent-assisted priority scorer** that runs before page sampling in `scan-ci.js`:

### Phase 1 – History-Weighted Sampling

1. Before sampling URLs from a sitemap, query the prior 3 runs' `resultsByUrl` for the same domain.
2. Build a URL-level violation history map: `{ url: { lastViolationCount, lastSeenAt, trend } }`.
3. Assign sampling weights: URLs with a history of violations (or that are new since the last scan) receive higher weight; consistently clean URLs receive lower weight.
4. Apply weighted random sampling instead of pure shuffle, respecting `maxPages`.

### Phase 2 – Agent-Assisted URL Scoring (GitHub Accessibility Agent)

1. Pass the weighted URL list to the GitHub Accessibility Agent with context: violation history, page titles, URL patterns (e.g. `/forms/`, `/account/`).
2. The agent boosts URLs matching high-risk patterns (form pages, authentication flows, interactive widgets) that axe-core is known to surface violations on.
3. Return a re-ranked list for final sampling.

### Phase 3 – Discovery Mode Feedback

Use prior violation IDs to enrich `discoveryQueries` in `targets.yml` automatically:
- If a site repeatedly shows `aria-required-attr` violations, add query terms that target interactive form pages in discovery mode.

### Configuration

```yaml
# targets.yml addition
sites:
  - name: va.gov
    sampling: history-weighted   # new option (default: shuffle)
    agent_priority: true          # opt-in to Phase 2 agent scoring
```

## Benefits

- Dramatically increases the signal-to-noise ratio of each scan run.
- Ensures high-impact pages are scanned in every run rather than occasionally.
- Creates a positive feedback loop: violations found → pages re-prioritized → violations tracked to resolution.
- Works within existing `maxPages` constraints; no infrastructure changes required.
- Aligned with the AGENTS.md principle of intelligent, bounded crawling.

## Acceptance Criteria

- [ ] `scan-ci.js` supports a `history-weighted` sampling mode that reads prior run data.
- [ ] URL weights are computed from violation counts and recency in prior runs.
- [ ] New/unseen URLs receive a moderate weight to ensure coverage of fresh content.
- [ ] Agent-priority scoring is optional and does not break existing shuffle/sequential modes.
- [ ] Unit tests cover the weight computation and sampling correctness.
- [ ] `targets.yml` schema updated to accept `sampling: history-weighted`.
- [ ] Backwards-compatible: existing targets without the new key behave identically.

## References

- [Getting Started with Accessibility Agents](https://accessibility.github.com/documentation/guide/getting-started-with-agents/)
- `scripts/scan-ci.js` – sitemap sampling logic (lines ~200-300)
- `scripts/shared-schema.js` – result schema
- `site/aggregate.csv` – historical metrics
- `tests/sitemap-sampling.test.js` – existing sampling tests to extend
