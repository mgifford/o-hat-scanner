# Feature Specification: Oobee-Style Report Revamp

**Feature Branch**: `001-oobee-style-report-revamp`  
**Created**: 2026-02-17  
**Status**: Draft  
**Input**: User description: "Revamp the reports to look like Oobee reports, focusing first on HTML/CSS revamp to adopting the Oobee design language including visual refresh, enhanced navigation, and grouped findings, while remaining lightweight for automated CI runs."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Visual Refresh & Dashboard (Priority: P1)

As a site owner, I want a modern, high-contrast dashboard view of my accessibility scan results so that I can quickly understand the health of my site at a glance.

**Why this priority**: Core objective of the request to emulate Oobee's aesthetic and usability.

**Independent Test**: Can be tested by running a scan and verifying the `/site/runs/<runId>/index.html` file uses the Oobee color scheme (purple/white/gray), card-based summary metrics, and modern typography.

**Acceptance Scenarios**:

1. **Given** a completed scan, **When** I open the report, **Then** I see the summary cards (Pages Scanned, Pages with Issues, Severity counts) in a grid layout similar to Oobee.
2. **Given** the new design, **When** I view the report on a mobile device, **Then** the layout responds correctly and remains readable.

---

### User Story 2 - Grouped Findings & Interactive Sidebar (Priority: P1)

As an accessibility specialist, I want issues to be grouped logically by severity with collapsible sections so that I can focus on resolving critical issues without being overwhelmed by data.

**Why this priority**: Enhances the actionable utility of the report, moving beyond a simple list to a structured findings interactive UI.

**Independent Test**: Can be tested by clicking on severity headers to expand/collapse and using the sidebar to jump between targets.

**Acceptance Scenarios**:

1. **Given** multiple violations, **When** I click a severity header (e.g., "Must Fix"), **Then** only issues of that severity are visible.
2. **Given** a multi-site scan, **When** I use the sidebar, **Then** I can navigate between different target results easily.

---

### User Story 3 - Lightweight Automated Output (Priority: P2)

As a DevOps engineer, I want the revamped reports to remain small in file size and fast to generate so that our CI/CD pipeline doesn't slow down or hit storage limits.

**Why this priority**: User explicitly requested the report remain "light" and mentioned that element screenshots are not yet required.

**Independent Test**: Compare the file size of the new `index.html` vs the old one; ensure it does not exceed 1MB for a standard 50-page scan.

**Acceptance Scenarios**:

1. **Given** a standard crawl, **When** the report is generated, **Then** no external image dependencies or heavy JS libraries are bundled unless necessary for the UI.
2. **Given** the report is static, **When** I open it without a web server (file://), **Then** all styling and logic function correctly.

### Edge Cases

- **No Violations**: How does the Oobee-style UI handle a "Perfect Scan" (0 issues)? It should show a clear, congratulatory "Pass" state.
- **Extreme Issue Counts**: If a page has 100+ instances of the same rule, does the UI remain performant?
- **Missing Meta Data**: If scan configuration data is missing, does the sidebar fallback gracefully?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST implement the Oobee color palette (Purple: #9021A6, Neutral Grays, and Standardized Severity Colors).
- **FR-002**: System MUST use a card-based dashboard for the top-level summary metrics.
- **FR-003**: System MUST group violations by Deque/Axe impact levels mapped to Oobee labels ("Must Fix", "Good to Fix", "Manual Review Required").
- **FR-004**: System MUST implementation collapsible/expandable sections for each violation type.
- **FR-005**: System MUST maintain 100% static HTML/CSS/JS output with no required backend/server.
- **FR-006**: System MUST ensure the new report UI itself passes WCAG 2.2 AA (consistency with project constraints).
- **FR-007**: System MUST provide a search/filter bar that updates the findings list in real-time.

### Key Entities

- **Report Dashboard**: The primary entry point for a run result, containing cards and trend indicators.
- **Violation Group**: A collection of Axe violations sharing the same rule ID and impact level.
- **Sidebar**: The navigation component providing context (Scan ID, Date, Target URL, Environment).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of findable accessibility issues from the Axe-core results are correctly categorized into the three Oobee severity groups.
- **SC-002**: Report generation time in GitHub Actions remains within 10% of the current baseline.
- **SC-003**: Generated report files achieve a score of 100% on automated accessibility checkers (e.g., Axe-core) for WCAG 2.2 AA.
- **SC-004**: Visual comparison shows >= 90% alignment with the reference Oobee `report.html` layout (Summary cards, sidebar, table/finding structure).
