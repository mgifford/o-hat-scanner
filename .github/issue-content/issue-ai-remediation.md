## Summary

Currently, scan reports surface axe-core violation descriptions and raw HTML snippets, but leave all interpretation and remediation to developers. GitHub's [Accessibility Agent](https://accessibility.github.com/documentation/guide/getting-started-with-agents/) can bridge this gap by generating context-aware, actionable fix suggestions for each violation directly within the report.

## Problem

- Scan reports show generic axe-core descriptions (e.g. `Elements must meet minimum color contrast ratio thresholds`) with no specific guidance on _how_ to fix the detected issue in the context of the actual HTML snippet.
- Developers unfamiliar with WCAG must research the rule, read external documentation, and then determine the fix themselves.
- This slows down remediation and increases the barrier for teams new to accessibility.

## Proposed Solution

Integrate a GitHub Accessibility Agent step into the report generation pipeline:

1. After `scan-ci.js` produces the JSON results, pass violation entries (axe rule ID + HTML snippet + WCAG criterion) to the GitHub Accessibility Agent.
2. The agent returns a concrete, code-level fix suggestion (e.g. revised HTML with correct contrast value or added `aria-label`).
3. `generate-report.js` embeds these AI-generated suggestions in each violation's expandable detail section alongside the existing axe description and selector.

### Example

**Current output:**

```
Rule: color-contrast
Description: Elements must meet minimum color contrast ratio thresholds
Element: <span style="color: #999">Status: Pending</span>
```

**Enhanced output with agent suggestion:**

```
Rule: color-contrast
Description: Elements must meet minimum color contrast ratio thresholds
Element: <span style="color: #999">Status: Pending</span>
💡 Suggested fix: Change color to #767676 or darker (e.g. #595959) to achieve a 4.5:1
contrast ratio on white backgrounds.
Example: <span style="color: #595959">Status: Pending</span>
```

## Benefits

- Dramatically reduces developer effort to remediate violations.
- Provides educational context alongside each issue.
- Keeps reports self-contained without requiring external documentation lookups.
- Consistent with AGENTS.md requirement that reports be actionable and WCAG 2.2 AA compliant.

## Acceptance Criteria

- [ ] Report HTML includes AI-generated fix suggestion for each violation entry (where available).
- [ ] Fix suggestions are collapsed by default (progressive disclosure) to avoid overwhelming the reader.
- [ ] Agent integration is configurable (opt-in via `targets.yml` flag or environment variable) so it does not block scans when unavailable.
- [ ] All new UI elements meet WCAG 2.2 AA contrast and semantic requirements.
- [ ] Tests updated to validate the presence and structure of suggestion markup.

## References

- [Getting Started with Accessibility Agents](https://accessibility.github.com/documentation/guide/getting-started-with-agents/)
- `scripts/generate-report.js` – violation rendering section
- `scripts/scan-ci.js` – post-scan hook opportunity
