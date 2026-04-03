# Getting Started

This guide gets you from zero to your first BackLens graph quickly.

## Prerequisites

- Node.js 18+
- pnpm 10+
- Git
- VS Code (for extension workflow)

## 1. Clone and Install

```bash
git clone https://github.com/adeebkhans/BackLens
cd BackLens
pnpm install
```

## 2. Run Core API

```bash
pnpm --filter @backlens/core-api dev
```

Keep this terminal running.

## 3. Run Web App

```bash
pnpm --filter @backlens/web dev
```

Open http://localhost:5173.

## 4. Explore First Graph in Web Mode

1. Use the left panel and click Load in Hotspots.
2. Click a hotspot to load a focused graph.
3. Click a node to inspect details in the right panel.
4. Use Expand Callers and Expand Callees.

## 5. Run VS Code Extension Mode

```bash
pnpm --filter backlens compile
```

Then:

1. Open the repo in VS Code.
2. Launch Extension Host (F5 from extension debug config).
3. In Explorer, right-click a folder and choose BackLens: Analyze Folder.
4. Click View Graph when analysis completes.

## 6. First Wow Moment

In graph view:

1. Select a hotspot node.
2. Expand callers/callees.
3. Double-click a node to navigate to source (extension mode).

You now have end-to-end analysis, graph exploration, and source navigation working.