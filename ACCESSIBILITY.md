# Accessibility Commitment (ACCESSIBILITY.md)

## 1. Our commitment

O-Hat Scanner is an automated accessibility testing tool. We hold ourselves to the same standard we help others meet: all generated reports must conform to **WCAG 2.2 Level AA**. We also commit to keeping the scanner itself free from accessibility barriers.

## 2. Real-time health metrics

| Metric | Status / Value |
| :--- | :--- |
| **Open A11y Issues** | [View open accessibility issues](https://github.com/mgifford/o-hat-scanner/labels/accessibility) |
| **Target standard** | WCAG 2.2 Level AA |
| **Automated test coverage** | Axe-core (all wcag2a / wcag2aa rules) — partial coverage only |
| **Generated report pages** | Must pass WCAG 2.2 AA checks (contrast, landmarks, headings, keyboard navigation) |

## 3. Severity taxonomy

O-Hat Scanner maps axe-core impact levels to the following severity labels in every report and CSV export. This taxonomy aligns with the [Accessibility Bug Reporting Best Practices](https://mgifford.github.io/ACCESSIBILITY.md/examples/ACCESSIBILITY_BUG_REPORTING_BEST_PRACTICES.html) guide.

| Axe impact | Severity label | Definition | Example |
|---|---|---|---|
| `critical` / `serious` | **Must Fix** | Users cannot complete a task, or a significant barrier blocks a key workflow | Image button with no accessible name; form error not announced to screen readers |
| `moderate` / `minor` | **Good to Fix** | Noticeable barrier; a workaround may exist | Missing visible focus indicator; redundant landmark |
| `review` / `incomplete` | **Manual Review Required** | Automated check cannot determine pass/fail; human confirmation needed | Colour contrast under ambiguous conditions; motion or animation |

### Frequency amplifies effective severity

A violation that appears on every page, or on a high-traffic page (e.g. home, sign-in, checkout), should be treated with higher urgency than its base severity suggests.

| Situation | Suggested priority adjustment |
|---|---|
| Low severity, appears on every page | Treat as Medium |
| Medium severity, appears on every page | Treat as High |
| Any severity on a top-task page | Escalate by one level |

Each violation in the HTML report shows **Pages with issue: X / Y scanned** to make frequency visible at a glance.

## 4. What is included in a scan report

Every scan produces an HTML report and a CSV export. The fields below are aligned with the [Accessibility Bug Reporting Best Practices](https://mgifford.github.io/ACCESSIBILITY.md/examples/ACCESSIBILITY_BUG_REPORTING_BEST_PRACTICES.html) schema.

### HTML report fields (per violation)

| Field | Description | Best-practice mapping |
|---|---|---|
| **Violation ID** | Axe-core rule identifier (e.g. `image-alt`) | `rule_id` |
| **Help text** | Short description of the accessibility failure | `summary` |
| **Impact** | Axe-core impact level (`critical`, `serious`, `moderate`, `minor`) | `severity` |
| **WCAG SC** | WCAG Success Criterion number(s) extracted from tags (e.g. `1.1.1`) | `wcag_sc` |
| **Pages with issue** | Count of affected pages and total pages scanned | `frequency` |
| **Selector / XPath** | CSS selector(s) identifying the failing element | `xpath` |
| **HTML snippet** | Minimal failing HTML fragment | `html_snippet` |
| **Failure summary** | Remediation guidance from axe-core | `suggested_fix` |
| **Learn more** | Link to axe-core documentation for the rule | `learnMore` |
| **Unique hash** | MD5 of `url + selector` — stable identifier for tracking over time | `instance_id` |

### CSV export columns (Oobee-compatible schema)

| Column | Description |
|---|---|
| `customFlowLabel` | Scan label (from `INPUT_LABEL`) |
| `deviceChosen` | `Desktop` or `Mobile` (from scan viewport setting) |
| `scanCompletedAt` | ISO-8601 timestamp of scan completion |
| `severity` | Must Fix / Good to Fix / Manual Review Required |
| `issueId` | Axe-core rule ID |
| `issueDescription` | Short rule description |
| `wcagConformance` | WCAG Success Criterion number(s) (e.g. `1.1.1, 4.1.2`) |
| `url` | Full URL of the affected page |
| `pageTitle` | `<title>` of the affected page |
| `context` | Failing HTML snippet |
| `howToFix` | Remediation guidance |
| `axeImpact` | Raw axe impact level |
| `xpath` | CSS selector(s) for the failing element |
| `learnMore` | URL to axe-core rule documentation |

## 5. Known limitations

Automated testing with axe-core provides **partial coverage** of WCAG 2.2 AA. A passing scan does **not** mean a page is fully accessible.

- Axe-core covers approximately 35–57% of WCAG criteria automatically.
- Keyboard navigation flows, screen reader announcements, and cognitive/motion issues require manual testing.
- The tool reports *potential* violations for some rules (marked "Manual Review Required") — human confirmation is needed to determine real-world impact.
- Single-page apps and content behind authentication may not be fully crawled.

**Do not cite O-Hat Scanner results as certification of WCAG conformance.**

## 6. Testing environment captured in reports

Each scan records the testing context as described in the best practices guide:

| Context field | Where it is recorded |
|---|---|
| Viewport class | Sidebar metadata: Desktop / Mobile |
| Colour scheme | Sidebar metadata: Light / Dark |
| Browser | Sidebar metadata: Chromium / Firefox / WebKit |
| Scan mode | Sidebar metadata: sitemap / crawl / list |
| Max pages | Sidebar metadata |
| Sample strategy & seed | Sidebar metadata |
| Scan date & timezone | Sidebar metadata |

## 7. Reporting accessibility issues in generated reports

If you find an accessibility issue **in the generated report pages themselves** (not in a scanned site), please open a GitHub issue using the `accessibility` label and include:

- The URL of the affected report page
- The WCAG Success Criterion violated (e.g. `1.4.3 Contrast`)
- A brief description of the barrier and which assistive technology you used to discover it
- The HTML snippet and selector if applicable

See the [Accessibility Bug Reporting Best Practices](https://mgifford.github.io/ACCESSIBILITY.md/examples/ACCESSIBILITY_BUG_REPORTING_BEST_PRACTICES.html) guide for a complete issue template.

## 8. Reporting accessibility issues in scanned sites

O-Hat Scanner reports violations found during a scan. To file an actionable bug report against a scanned site, use the **Copy failure details** button on any violation in the HTML report. This copies a pre-formatted summary including:

- Violation ID and description
- Affected page URL
- HTML snippet and selector
- Failure summary and remediation guidance
- WCAG criterion reference

Paste this into a GitHub issue or your preferred bug tracker. Supplement with manual testing steps, assistive technology details, and an impact statement per the best practices guide.

## 9. Contributor requirements

To contribute to this repository, follow these guidelines:

- **TDD is mandatory**: write a failing test before implementing any change (see `AGENTS.md`).
- **No accessibility regressions**: any change to report HTML or CSS must not introduce WCAG 2.2 AA violations. Check contrast, landmarks, headings, and keyboard navigation.
- **Maintain the severity taxonomy**: do not change the mapping between axe impact and severity labels without updating this document and related tests.
- **Keep the report static**: no backend, no database. All interactivity is client-side JavaScript.
- **Run the test suite**: `npm test` must pass before merging.

## 10. Continuous improvement

We review and update the following regularly:

- Accessibility test coverage as new axe-core rules become available
- Severity taxonomy as WCAG standards evolve
- Report template accessibility (contrast, keyboard navigation, screen reader support)
- CSV schema alignment with emerging standards (e.g. Oobee, EARL)

Last updated: 2026-04-02
