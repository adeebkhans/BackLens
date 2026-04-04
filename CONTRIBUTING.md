# Contributing to BackLens

Thanks for contributing.

## Prerequisites

- Node.js 18+
- pnpm 10+

## Setup

1. Install dependencies from repo root:
   - pnpm install
2. Build parser and graph-store when needed:
   - pnpm --filter parser build
   - pnpm --filter graph-store build

## Typical Local Workflow

1. Parse a target project:
   - pnpm --filter parser dev "../../examples/express-backend-demo"
2. Build graph JSON:
   - pnpm --filter graph-store dev -- build-ir ../parser/ir.json graph.json
3. Save SQLite DB:
   - pnpm --filter graph-store dev -- save-sqlite graph.json graph.db
4. Run API:
   - pnpm --filter @backlens/core-api dev
5. Run web UI:
   - pnpm --filter @backlens/web dev

## Extension Workflow

1. Build extension assets:
   - pnpm --filter backlens compile
2. Launch Extension Host in VS Code
3. Run BackLens: Analyze Folder
4. Open BackLens: Show Graph

## Pull Requests

- Keep changes focused and small when possible.
- Add or update docs when behavior changes.
- Add or update tests for parser and graph behavior when relevant.
- Avoid unrelated refactors in the same PR.

## Legal

By submitting a contribution, you agree that your contribution is provided under the repository license (AGPL-3.0-only).