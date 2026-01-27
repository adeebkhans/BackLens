/**
 * Transitive traversal routes - Multi-hop call graph analysis
 */
import { FastifyPluginAsync } from "fastify";
import type { TraversalQueryParams, PathQueryParams } from "../types.js";

const traversal: FastifyPluginAsync = async (app: any) => {
  /**
   * GET /traversal/:id/callers/transitive
   * Get all transitive callers (multi-hop incoming calls)
   * ?tree=true returns hierarchical tree structure
   * ?tree=false (default) returns flat list
   */
  app.get("/:id/callers/transitive", async (req: any) => {
    const { id } = req.params;
    const { tree, ...queryOpts } = req.query as TraversalQueryParams;
    const opts = parseQueryOptions(queryOpts);

    const treeFlag = typeof tree === "string" ? tree === "true" : tree === true;
    const result = treeFlag
      ? app.graph.transitiveCallersTree(id, opts)
      : app.graph.transitiveCallersFlat(id, opts);

    return {
      success: true,
      data: result,
      meta: {
        nodeId: id,
        format: treeFlag ? "tree" : "flat",
        maxDepth: opts.maxDepth
      }
    };
  });

  /**
   * GET /traversal/:id/callees/transitive
   * Get all transitive callees (multi-hop outgoing calls)
   */
  app.get("/:id/callees/transitive", async (req: any) => {
    const { id } = req.params;
    const { tree, ...queryOpts } = req.query as TraversalQueryParams;
    const opts = parseQueryOptions(queryOpts);

    const treeFlag = typeof tree === "string" ? tree === "true" : tree === true;
    const result = treeFlag
      ? app.graph.transitiveCalleesTree(id, opts)
      : app.graph.transitiveCalleesFlat(id, opts);

    return {
      success: true,
      data: result,
      meta: {
        nodeId: id,
        format: treeFlag ? "tree" : "flat",
        maxDepth: opts.maxDepth
      }
    };
  });

  /**
   * GET /traversal/path/all
   * Find all call chains between two nodes
   * ?start=nodeId&target=nodeId&depthLimit=10&maxPaths=100
   */
  app.get("/path/all", async (req: any, reply: any) => {
    const { start, target, depthLimit, maxPaths, ...queryOpts } = req.query as PathQueryParams;

    if (!start || !target) {
      return reply.code(400).send({
        success: false,
        error: {
          message: "Both 'start' and 'target' query parameters are required",
          code: "MISSING_PARAMS"
        }
      });
    }

    const opts = {
      ...parseQueryOptions(queryOpts),
      depthLimit: depthLimit ? Number(depthLimit) : undefined,
      maxPaths: maxPaths ? Number(maxPaths) : undefined
    };

    const results = app.graph.allCallChains(start, target, opts);

    return {
      success: true,
      data: results,
      meta: {
        start,
        target,
        pathCount: results.length,
        depthLimit: opts.depthLimit,
        maxPaths: opts.maxPaths
      }
    };
  });
};

/**
 * Parse query options from URL params
 */
function parseQueryOptions(query: any) {
  return {
    expanded: query.expanded !== undefined ? (query.expanded as any) === true || (query.expanded as any) === "true" : true,
    includeTypes: query.includeTypes ? query.includeTypes.split(",") : undefined,
    excludeTypes: query.excludeTypes ? query.excludeTypes.split(",") : undefined,
    maxDepth: query.maxDepth ? Number(query.maxDepth) : undefined
  };
}

export default traversal;