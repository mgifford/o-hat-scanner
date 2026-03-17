# GitHub Copilot Instructions

## Primary Reference

**Read [`AGENTS.md`](../AGENTS.md) first.** It is the authoritative guide for all automated agents and contains non-negotiable constraints, repo layout, schema contracts, crawling rules, reporting rules, TDD requirements, and accessibility targets. Everything in this file is supplementary to it.

---

## What this repo does

This is a **CI-focused accessibility scanner** built on Playwright + axe-core. It:

1. Crawls configured target sites (via `targets.yml`)
2. Runs axe accessibility checks on each page
3. Publishes static HTML + CSV reports to GitHub Pages under `/site`

The standalone UI has moved to [o-hat-standalone](https://github.com/civicactions/o-hat-standalone). This repo is CI/reporting only.

---

## How to bootstrap

```bash
npm install
npx playwright install --with-deps chromium
npm test          # runs the full test suite (Jest)
```

Tests live in `tests/`. Run a single file with:

```bash
npx jest tests/<filename>.test.js
```

---

## Key constraints (from AGENTS.md — do not violate)

- **TDD is mandatory**: write a failing test before implementing any change.
- **WCAG 2.2 AA**: the generated reports must themselves be accessible. Every UI change needs accessibility tests (contrast, landmarks, headings).
- **Shared schema**: all scan output must conform to the shape in `scripts/shared-schema.js`. Only add fields in a backwards-compatible way.
- **Static reports**: no backend, no database. All interactivity is client-side JavaScript.
- **Bounded crawling**: concurrency defaults to 2; never implement an uncontrolled crawler.

---

## Other documentation

| File | Purpose |
|------|---------|
| [`AGENTS.md`](../AGENTS.md) | Full agent guide — constraints, layout, schema, TDD, accessibility |
| [`CONTRIBUTING.md`](../CONTRIBUTING.md) | Human contribution guidelines |
| [`SECURITY.md`](../SECURITY.md) | Security policy and vulnerability reporting |
| [`DATA_LOSS_PROTECTION.md`](../DATA_LOSS_PROTECTION.md) | Rules for protecting scan data and avoiding data loss |
| [`README.md`](../README.md) | Project overview and quick-start |

---

## Errors and workarounds encountered during onboarding

_None encountered. Document any future errors here with the steps taken to resolve them._
