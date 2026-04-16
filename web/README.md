# @backlens/web

Interactive graph explorer UI for BackLens.

This package renders code graph data using React Flow and supports two runtime modes through a provider abstraction:

- Standalone web mode via HTTP (core-api)
- VS Code webview mode via postMessage RPC

## Stack

- React 18 + TypeScript
- Vite
- React Flow
- Zustand
- Axios
- Tailwind CSS

## Runtime Architecture

The frontend does not directly depend on a specific transport.

- `HttpGraphProvider`: calls core-api over HTTP
- `VsCodeGraphProvider`: calls extension host via request/response messaging
- `createProvider.ts`: auto-detects environment and returns the correct provider singleton

## Main UX

Three-panel layout:

- Left panel
  - Search
  - Hotspots tab
  - Classes tab with lazy method expansion
  - Global filters: hide external, hide framework, include function calls, include method calls
- Center panel
  - React Flow graph canvas
  - Minimap and controls
  - Incremental expansion (callers/callees)
- Right panel
  - Node inspector and actions

Graph behavior highlights:

- Incremental graph loading (avoid full hairball render)
- Collision-aware grid placement
- Directional layout conventions (callers left, callees right)
- Deduplicated node and edge insertion
- Selection-aware edge highlighting/dimming

## Scripts

- `pnpm dev` - Start Vite dev server
- `pnpm build` - Type-check and build production assets
- `pnpm preview` - Preview built app
- `pnpm lint` - Run ESLint

## Environment Variables

See `.env.example`.

- `VITE_API_URL` - Backend origin for Vite dev proxy target (default http://localhost:4000)
- `VITE_API_BASE` - Axios base path used by client (default /api)
- `VITE_API_TIMEOUT` - Axios timeout in ms (default 10000)
- `VITE_DEV_PORT` - Vite dev server port (default 5173)

## Standalone Mode Setup

1. Start core-api.
2. Start web app.

Example:

```bash
pnpm --filter @backlens/core-api dev
pnpm --filter @backlens/web dev
```

Default dev routing:

- Browser requests `/api/*`
- Vite proxy forwards to `VITE_API_URL` and strips `/api` prefix

## VS Code Extension Mode

The extension embeds the built web assets in a webview.

In this mode:

- Transport switches automatically to `VsCodeGraphProvider`
- Queries are handled by extension message bus and graph service
- Double-click navigation can open source locations in editor

## Project Structure

```text
src/
  api/
    createProvider.ts
    graphApi.ts
    HttpGraphProvider.ts
    IGraphProvider.ts
    VsCodeGraphProvider.ts
  components/
    graph/
      GraphCanvas.tsx
      GraphNode.tsx
      nodeTypes.ts
    layout/
      GraphPanel.tsx
      LeftPanel.tsx
      RightPanel.tsx
  store/
    graphStore.ts
  styles/
    globals.css
  types/
    graph.ts
  App.tsx
  main.tsx
```

## Notes

- Vite `base` is set to `./` to keep built assets compatible with extension webview loading.
- The UI currently has path APIs available through provider contracts, while primary exploration flows are hotspot/search + caller/callee expansion.
