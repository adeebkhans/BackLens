# @backlens/core-api

Fastify-based REST API for BackLens graph queries.

This package wraps @backlens/graph-store and exposes HTTP endpoints for node search, call graph traversal, path analysis, and analytics.

## Runtime

- Framework: Fastify
- Module type: ESM
- Graph engine: @backlens/graph-store

## Scripts

- dev: tsx watch src/server.ts
- build: tsc
- start: node dist/server.js

## Environment Variables

- PORT: default 4000
- HOST: default 0.0.0.0
- GRAPH_DB: path to SQLite graph DB
  - default resolves to packages/graph-store/graph.db
- NODE_ENV: default development
- LOG_LEVEL: default info

## Route Groups

Base route index:

- GET /

Health:

- GET /health
- GET /health/ready

Nodes:

- GET /nodes/:id
- GET /nodes
  - supports q, limit, includeTypes, excludeTypes
  - if q is omitted and type filters are present, returns typed node listing

Calls:

- GET /calls/:id/callers
- GET /calls/:id/callees
- GET /calls/:id/functions
- GET /calls/:id/methods
- GET /calls/:id/classes

Traversal:

- GET /traversal/:id/callers/transitive
- GET /traversal/:id/callees/transitive
- GET /traversal/path/shortest
- GET /traversal/path/all

Analytics:

- GET /analytics/hotspots
- GET /analytics/stats
- GET /analytics/semantic-stats

## Query Options

For calls, traversal, and hotspots routes, these query options are parsed:

- expanded (default true)
- includeTypes (comma-separated)
- excludeTypes (comma-separated)
- maxDepth
- hideExternal
- hideFramework
- edgeTypes (comma-separated, for example call,method_call)

Additional route-specific options:

- traversal transitive routes: tree (true for tree, false for flat)
- /traversal/path/shortest: start, target, depthLimit
- /traversal/path/all: start, target, depthLimit, maxPaths
- /analytics/hotspots: top

## Response Shape

Most data routes return:

- success
- data
- optional meta

Examples:

- GET /nodes/:id returns 404 with success false when missing
- GET /traversal/path/shortest returns success true with data as null when no path is found

Health routes are plain status payloads rather than wrapped success/data objects.

## Notes

- CORS is open in development and restricted in non-development modes.
- Global error handler returns structured API errors:
  - success false
  - error.message
  - error.code
- /analytics/stats currently returns a placeholder message unless graph-store exposes getStats.

## Local Development

1. Install dependencies from workspace root.
2. Ensure graph DB exists (for example packages/graph-store/graph.db).
3. Run dev server:
   - pnpm --filter @backlens/core-api dev
4. Open:
   - http://localhost:4000
