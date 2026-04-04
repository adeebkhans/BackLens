# Architecture Overview

## Purpose

BackLens provides static code intelligence with graph-based exploration for backend-oriented repositories.

## End-to-End Flow

1. Parser reads project files and emits IR.
2. Graph-store transforms IR into graph nodes and edges.
3. Graph-store persists graph to SQLite.
4. Query surfaces expose graph data:
   - Graph-store API
   - Core REST API
   - VS Code extension message bus
5. UI renders graph and interaction flows.

## Runtime Modes

## Standalone Mode

Flow:

- Source -> Parser -> IR -> Graph-store -> SQLite -> Core API -> Web UI

Characteristics:

- HTTP transport between UI and backend.
- Vite dev proxy forwards `/api` to core-api.

## VS Code Extension Mode

Flow:

- Source -> Analyze Worker -> IR/Graph/SQLite (WASM path) -> GraphService -> MessageBus -> Webview UI

Characteristics:

- In-process querying via message bus.
- No HTTP requirement for extension graph operations.
- Source navigation from graph nodes into editor.

## Package Responsibilities

- `packages/parser`: static extraction and IR generation.
- `packages/graph-store`: graph model, persistence, traversal/path/hotspot queries.
- `packages/core-api`: Fastify REST wrapper for graph-store.
- `web`: graph exploration UI with provider abstraction.
- `vscode-extension`: project lifecycle, analysis orchestration, webview integration.

## Data Model Summary

Node types:

- file
- function
- class
- method
- external

Edge types:

- contains
- call
- method_call

## Query Abstractions

Graph-store capabilities include:

- direct callers/callees
- transitive traversal (flat/tree)
- all call chains
- shortest call chain
- hotspots
- semantic stats

These are projected through:

- core-api routes
- extension RPC commands
- web providers

## Why This Architecture

- Shared graph-store query core avoids duplicated query logic.
- Provider abstraction lets one UI run in both standalone and extension contexts.
- SQLite persistence enables local reproducible analysis state.