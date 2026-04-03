# Parser Fixtures

This folder contains package-level fixtures for parser-focused tests.

## Purpose

Each fixture should be small and intentionally scoped to one behavior, such as:

- import/export resolution
- method call resolution
- this.method handling
- instance mapping via new ClassName()
- nested function ownership
- CommonJS require patterns

## Rules

- Keep fixtures tiny and focused.
- One fixture should primarily test one behavior.
- Do not place full demo repos here.
- Use root examples/ for system-level sample projects.
