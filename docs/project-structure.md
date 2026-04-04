# Project Structure

BackLens is a pnpm monorepo with five primary working areas.

## packages/parser

Purpose:

- Parse source files into IR (intermediate representation).

Used by:

- extension analyze worker
- standalone parsing workflow

Key entry points:

- `packages/parser/src/index.ts`

## packages/graph-store

Purpose:

- Build graph model from IR.
- Persist/query graph in SQLite.

Used by:

- core-api
- VS Code extension graph service

Key entry points:

- `packages/graph-store/src/api/GraphAPI.ts`
- `packages/graph-store/src/api/GraphAPIImpl.ts`
- `packages/graph-store/src/api/createGraphAPI.ts`
- `packages/graph-store/src/index.ts`

## packages/core-api

Purpose:

- Expose graph queries via Fastify REST routes.

Used by:

- standalone web UI
- external tooling

Key entry points:

- `packages/core-api/src/server.ts`
- `packages/core-api/src/app.ts`
- `packages/core-api/src/routes/*`

## web

Purpose:

- Interactive graph visualization and exploration UI.

Used by:

- standalone mode in browser
- VS Code extension webview bundle

Key entry points:

- `web/src/main.tsx`
- `web/src/App.tsx`
- `web/src/store/graphStore.ts`
- `web/src/api/createProvider.ts`

## vscode-extension

Purpose:

- VS Code-native analysis and graph exploration workflow.

Used by:

- VS Code users (extension mode)

Key entry points:

- `vscode-extension/src/extension.ts`
- `vscode-extension/src/core/AnalysisWorker.ts`
- `vscode-extension/src/services/GraphService.ts`
- `vscode-extension/src/providers/GraphWebviewProvider.ts`
- `vscode-extension/src/messaging/MessageBus.ts`