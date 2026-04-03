# Graph Query Contract

Purpose:

Keep Web UI, Core API, Extension RPC, and GraphStore behavior aligned.

## Mapping Table

| Feature | UI Action | Provider Method | HTTP Route (Standalone) | Extension RPC Command | GraphStore Method |
|---|---|---|---|---|---|
| Search Nodes | Left panel Search | `searchNodes(query, limit?)` | `GET /nodes?q=...` | `searchNodes` | `searchNodes(query, options?)` |
| Load Node | Node selection/load | `getNode(id)` | `GET /nodes/:id` | `getNode` | `getNode(id)` |
| Expand Callers | Inspector Expand Callers | `getCallers(id, options?)` | `GET /calls/:id/callers` | `getCallers` | `getCallers(id, options?)` |
| Expand Callees | Inspector Expand Callees | `getCallees(id, options?)` | `GET /calls/:id/callees` | `getCallees` | `getCallees(id, options?)` |
| Transitive Callers | Traversal workflow | `getTransitiveCallers(id, options?)` | `GET /traversal/:id/callers/transitive` | `getTransitiveCallers` | `transitiveCallersFlat/Tree` |
| Transitive Callees | Traversal workflow | `getTransitiveCallees(id, options?)` | `GET /traversal/:id/callees/transitive` | `getTransitiveCallees` | `transitiveCalleesFlat/Tree` |
| Hotspots | Left panel Hotspots Load | `getHotspots(top?, options?)` | `GET /analytics/hotspots` | `getHotspots` | `hotspots(options?)` |
| Shortest Path | Path workflow | `getShortestPath(start, target, options?)` | `GET /traversal/path/shortest` | `getShortestPath` | `shortestCallChain(start, target, options?)` |
| All Paths | Path workflow | `getAllPaths(start, target, options?)` | `GET /traversal/path/all` | `getAllPaths` | `allCallChains(start, target, options?)` |
| Functions in File | Class/File exploration | `getFunctionsInFile(fileId, options?)` | `GET /calls/:id/functions` | `getFunctionsInFile` | `getFunctionsInFile(id, options?)` |
| List Classes | Classes tab load | `getClasses(options?)` | `GET /nodes?includeTypes=class` | `getClasses` | `getAllNodes({ includeTypes: ['class'] })` |
| Methods of Class | Classes tab expand | `getMethodsOfClass(classId, options?)` | `GET /calls/:id/methods` | `getMethodsOfClass` | `getFunctionsInFile(classId, { includeTypes:['method'] })` |
| Classes in File | File hierarchy flow | `getClassesInFile(fileId, options?)` | `GET /calls/:id/classes` | `getClassesInFile` | `getFunctionsInFile(fileId, { includeTypes:['class'] })` |
| Semantic Stats | Stats flow | `getSemanticStats()` | `GET /analytics/semantic-stats` | `getSemanticStats` | `getSemanticStats()` |
| Navigate to Source | Graph node double-click | `navigateToNode?(nodeId)` | N/A | `command: backlens.goToNode` | via NavigationService + node metadata |

## Query Option Contract

Shared options expected across provider/API layers:

- `expanded`
- `includeTypes`
- `excludeTypes`
- `maxDepth`
- `hideExternal`
- `hideFramework`
- `edgeTypes`

Rules:

- `edgeTypes` uses plural form and comma-separated encoding over HTTP.
- Booleans over HTTP may arrive as string and must be parsed server-side.

## Safety Checklist for New Features

When adding a new graph feature:

1. Add GraphStore method and tests.
2. Add core-api route (if standalone mode should support it).
3. Add extension RPC command handling in MessageBus.
4. Add provider method to `IGraphProvider` and implementations.
5. Wire UI action to provider.
6. Update this contract doc.

## Drift Detection Checklist

Run this before merges:

1. Verify provider method names match MessageBus command names.
2. Verify provider HTTP routes match core-api registered routes.
3. Verify query option names match (`edgeTypes`, not `edgeType`).
4. Build all affected packages.