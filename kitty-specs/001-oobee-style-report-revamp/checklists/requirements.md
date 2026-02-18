# Quality Checklist: Oobee-Style Report Revamp

## 🎨 Visual Design
- [ ] Primary purple color (#9021A6 or Oobee equivalent) implemented for headers/accents.
- [ ] Summary cards (Grid layout) implemented for top-level stats.
- [ ] Sidebar metadata matches Oobee structure (Run ID, Date, Target, Environment).
- [ ] Fonts updated to a clean sans-serif (Inter/Roboto/System Default as per Oobee).

## 🛠 Functionality
- [ ] Violations correctly mapped to "Must Fix", "Good to Fix", and "Manual Review".
- [ ] Collapsible severity sections work with keyboard and click.
- [ ] Search filter correctly hides/shows violations based on text input.
- [ ] CSV Export remains functional and data-aligned.
- [ ] The report works as a standalone static file (no broken relative paths).

## ♿️ Accessibility & Standards
- [ ] Report UI passes Axe-core scan with 0 critical violations.
- [ ] High contrast ratios maintained for all new UI elements.
- [ ] Focus states are clearly visible for all interactive elements.
- [ ] Semantic HTML5 used for sidebar, main content, and headers.

## 🚀 Performance
- [ ] HTML file size remains under 2MB for a typical scan.
- [ ] No external blocking scripts or heavy dependencies (e.g. jQuery) added unless absolutely necessary.
- [ ] Generation script `scripts/generate-report.js` completes without errors in CI.
