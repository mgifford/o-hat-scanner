# Contributing to o-hat-scanner

Thank you for your interest in contributing to **o-hat-scanner**. Contributions of all kinds are welcome: code, documentation, testing, bug reports, accessibility improvements, and ideas for new features.

We especially welcome contributors with disabilities. Accessibility expertise and lived experience are valuable forms of knowledge and are important to improving tools like this one.

The goal of this guide is to make contributing as straightforward and predictable as possible.

---

# Table of Contents

- Ways to Contribute
- Development Environment Setup
- Project Structure
- Coding Standards
- Testing Requirements
- Submitting Changes
- Code Review Process
- Reporting Bugs
- Requesting Features
- Community Guidelines
- Communication

---

# Ways to Contribute

You can contribute in several ways:

- Fix bugs
- Improve scanning accuracy
- Add new detection rules
- Improve performance
- Improve accessibility
- Improve documentation
- Write tests
- Review pull requests
- Report issues or request features

Contributions that improve usability, accessibility, and documentation are just as valuable as code.

---

# Development Environment Setup

## Prerequisites

You will need:

- Git
- Node.js 24 LTS (or later)
- npm or pnpm

Check versions:

node --version  
npm --version

---

## Clone the Repository

git clone https://github.com/mgifford/o-hat-scanner.git  
cd o-hat-scanner

---

## Install Dependencies

npm install

or if using pnpm:

pnpm install

---

## Running the Scanner

Example command:

node scan.js https://example.com

Depending on the project configuration, there may also be scripts available:

npm run scan

---

## Running in Development Mode

If the project uses a watcher or dev script:

npm run dev

---

# Project Structure

Typical layout:

o-hat-scanner/  
├── src/                Source code  
├── tests/              Automated tests  
├── scripts/            Utility scripts  
├── docs/               Documentation  
├── package.json  
└── README.md  

Key areas contributors may work in:

- Scanner logic
- Detection rules
- Performance improvements
- CLI interface
- Accessibility improvements

---

# Coding Standards

Consistency improves maintainability.

## General Principles

- Prefer clear and readable code
- Avoid unnecessary complexity
- Keep functions focused and small
- Add comments where logic is not obvious

---

## JavaScript Style

Follow common JavaScript best practices:

- Use const by default
- Use let when mutation is required
- Avoid var
- Prefer modern ES syntax
- Use async/await rather than callbacks when possible

Example pattern:

async function scanSite(url) {
  const result = await scanner.run(url)
  return result
}

---

## Formatting

If a formatter is configured (for example Prettier or ESLint), run:

npm run lint

or

npm run format

before submitting changes.

---

# Testing Requirements

All significant changes should include tests.

Run tests with:

npm test

Tests should:

- Validate scanner results
- Prevent regressions
- Cover edge cases when possible

When adding new scanning logic:

- Include at least one positive detection test
- Include one negative test case

---

# Submitting Changes

## 1. Create a Branch

git checkout -b feature/my-feature

Use descriptive names such as:

fix/scan-timeout  
feature/new-rule  
docs/improve-readme  

---

## 2. Make Changes

Write clear commits.

Examples:

Improve detection of misconfigured headers  
Fix scan timeout on slow domains  
Update documentation for CLI usage  

---

## 3. Run Tests and Linting

Before submitting:

npm test  
npm run lint

---

## 4. Submit a Pull Request

Push your branch:

git push origin feature/my-feature

Then open a Pull Request on GitHub.

Include:

- Description of the change
- Why the change is needed
- Screenshots or logs if relevant
- Any new dependencies introduced

---

# Code Review Process

All contributions go through review.

Reviewers may request:

- Clarification
- Code improvements
- Additional tests
- Documentation updates

The goal is to improve the project, not criticize contributors. Expect iterative feedback as part of the process.

---

# Reporting Bugs

If you find a bug, please open a GitHub Issue.

Include:

- Description of the problem
- Steps to reproduce
- Expected behavior
- Actual behavior
- Example URL if relevant
- Environment details (OS, Node version)

Example:

Node: 20.3.0  
OS: macOS  
Scanner version: main branch  

---

# Requesting Features

Feature requests are welcome.

When requesting a feature, describe:

- The problem you are trying to solve
- Why the current behavior is insufficient
- A possible approach if you have one

This helps maintainers evaluate proposals.

---

# Community Guidelines

This project follows an open and respectful collaboration model.

All contributors are expected to:

- Be respectful
- Be constructive
- Assume good intent
- Focus on improving the project

Accessibility and usability are core goals of this project. Contributions that improve the experience for people with disabilities are strongly encouraged.

---

# Communication

Primary communication channels:

- GitHub Issues — bugs and feature requests
- GitHub Discussions — design ideas and questions
- Pull Requests — code review and implementation discussion

When asking questions:

- Provide context
- Include relevant logs or examples
- Be clear about what you tried

---

# First Time Contributors

If you're new to the project, look for issues labeled:

good first issue  
help wanted  

Documentation improvements are also a great way to start contributing.

---

# License

By contributing to this repository, you agree that your contributions will be licensed under the same license used by this project.
