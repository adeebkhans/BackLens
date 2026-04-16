# @backlens/graph-store

SQLite-backed graph query engine for BackLens.

This package converts IR into graph data, persists graph state, and exposes a typed `GraphAPI` used by core-api and the VS Code extension.

## What This Package Contains

- IR processing
  - `src/core-ir-processor/buildGraph.ts`
  - `src/core-ir-processor/types.ts`
- Persistence adapters and stores
  - `src/persistence/BetterSqliteAdapter.ts`
  - `src/persistence/WasmSqliteAdapter.ts`
  - `src/persistence/NodeStore.ts`
  - `src/persistence/EdgeStore.ts`
  - `src/persistence/saveToDB.ts`
- Traversal and analytics algorithms
  - `src/algorithms/traversal.ts`
- Public API surface
  - `src/api/GraphAPI.ts`
  - `src/api/GraphAPIImpl.ts`
  - `src/api/QueryOptions.ts`
  - `src/api/createGraphAPI.ts`
  - `src/api/filterUtils.ts`
- CLI entrypoint
  - `src/index.ts`

## GraphAPI Surface

- Metadata and search
  - `getNode(nodeId)`
  - `searchNodes(query, options?)`
  - `getAllNodes(options?)`
  - `getAllEdges()`
- Direct neighbors
  - `getCallers(nodeId, options?)`
  - `getCallees(nodeId, options?)`
  - `getFunctionsInFile(nodeId, options?)`
- Transitive traversal
  - `transitiveCallersFlat(nodeId, options?)`
  - `transitiveCallersTree(nodeId, options?)`
  - `transitiveCalleesFlat(nodeId, options?)`
  - `transitiveCalleesTree(nodeId, options?)`
- Path analysis
  - `allCallChains(startId, targetId, options?)`
  - `shortestCallChain(startId, targetId, options?)`
- Analytics
  - `hotspots(options?)`
  - `getSemanticStats()`
- Lifecycle
  - `close()`

## QueryOptions

Supported options:

- `expanded` (default true)
- `includeTypes`
- `excludeTypes`
- `maxDepth`
- `hideExternal`
- `hideFramework`
- `edgeTypes` (for edge-type constrained traversals and pathfinding)

## Notes

- `allCallChains` returns all simple paths with optional `depthLimit` and `maxPaths`.
- `shortestCallChain` returns the shortest path by hop count (or `null` if unreachable).
- Both native SQLite and WASM SQLite adapters are supported for different runtimes.