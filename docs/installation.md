# Installation

This guide is setup-only.

## Prerequisites

- Node.js 18+
- pnpm 10+
- VS Code 1.108+ (for extension mode)

## Root Setup

```bash
git clone https://github.com/adeebkhans/BackLens
cd BackLens
pnpm install
```

## Standalone Mode Setup

Standalone mode uses parser + graph-store + core-api + web.

### 1. Parse Source

```bash
pnpm --filter @backlens/parser dev <path-to-project>
```

### 2. Build Graph JSON

```bash
pnpm --filter @backlens/graph-store dev -- build-ir ../parser/ir.json graph.json
```

### 3. Save SQLite DB

```bash
pnpm --filter @backlens/graph-store dev -- save-sqlite graph.json graph.db
```

### 4. Run API

```bash
pnpm --filter @backlens/core-api dev
```

### 5. Run Web UI

```bash
pnpm --filter @backlens/web dev
```

## VS Code Extension Mode Setup

### 1. Build Web Assets and Extension Bundle

```bash
pnpm --filter backlens compile
```

Notes:

- `prebuild` builds web assets.
- `scripts/copyWebview.js` copies web build output into `vscode-extension/webview`.

### 2. Launch Extension Host

In VS Code, run the extension debug launch configuration and open a test workspace.

### 3. Analyze Project

Use BackLens: Analyze Folder from Explorer or BackLens activity view.

## Optional Environment Variables

Web `.env` / `.env.example`:

- `VITE_API_URL`
- `VITE_API_BASE`
- `VITE_API_TIMEOUT`
- `VITE_DEV_PORT`

Core API env:

- `PORT`
- `HOST`
- `GRAPH_DB`
- `NODE_ENV`
- `LOG_LEVEL`

## Common Setup Mistakes

- Running web without core-api in standalone mode.
- Forgetting to compile extension before Extension Host launch.
- Missing `pnpm install` at workspace root.
- Using unsupported Node.js version.