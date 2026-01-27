/**
 * Direct call relationship routes - Callers and Callees
 */ 
import { FastifyPluginAsync } from "fastify";
import type { QueryOptionsParams } from "../types.js";

const calls: FastifyPluginAsync = async (app: any) => {
  /**
   * GET /calls/:id/callers
   * Get direct callers of a node (incoming call edges)
   */
  app.get("/:id/callers", async (req: any) => {
    const { id } = req.params;
    const query = req.query as QueryOptionsParams;
    const opts = parseQueryOptions(query);

    const result = app.graph.getCallers(id, opts);
    
    return {
      success: true,
      data: result,
      meta: {
        nodeId: id,
        count: result.raw.length
      }
    };
  });

  /**
   * GET /calls/:id/callees
   * Get direct callees of a node (outgoing call edges)
   */
  app.get("/:id/callees", async (req: any) => {
    const { id } = req.params;
    const query = req.query as QueryOptionsParams;
    const opts = parseQueryOptions(query);
    
    const result = app.graph.getCallees(id, opts);
    
    return {
      success: true,
      data: result,
      meta: {
        nodeId: id,
        count: result.raw.length
      }
    };
  });

  /**
   * GET /calls/:id/functions
   * Get all functions contained in a file node
   */
  app.get("/:id/functions", async (req: any) => {
    const { id } = req.params;
    const opts = parseQueryOptions(req.query);
    
    const result = app.graph.getFunctionsInFile(id, opts);
    
    return {
      success: true,
      data: result,
      meta: {
        fileId: id,
        count: result.raw.length
      }
    };
  });

  /**
   * GET /calls/:id/methods
   * Get all methods of a class node (via contains edges)
   */
  app.get("/:id/methods", async (req: any) => {
    const { id } = req.params;
    const opts = parseQueryOptions(req.query);
    
    // Use getFunctionsInFile which queries 'contains' edges, then filter to methods
    const result = app.graph.getFunctionsInFile(id, {
      ...opts,
      includeTypes: ['method']
    });
    
    return {
      success: true,
      data: result,
      meta: {
        classId: id,
        count: result.raw.length
      }
    };
  });

  /**
   * GET /calls/:id/classes
   * Get all classes in a file node (via contains edges)
   */
  app.get("/:id/classes", async (req: any) => {
    const { id } = req.params;
    const opts = parseQueryOptions(req.query);
    
    // Use getFunctionsInFile which queries 'contains' edges, then filter to classes
    const result = app.graph.getFunctionsInFile(id, {
      ...opts,
      includeTypes: ['class']
    });
    
    return {
      success: true,
      data: result,
      meta: {
        fileId: id,
        count: result.raw.length
      }
    };
  });
};

/**
 * Parse query options from URL params
 */
function parseQueryOptions(query: QueryOptionsParams) {
  return {
    expanded: query.expanded !== undefined ? (query.expanded as any) === true || (query.expanded as any) === "true" : true,
    includeTypes: query.includeTypes ? query.includeTypes.split(",") : undefined,
    excludeTypes: query.excludeTypes ? query.excludeTypes.split(",") : undefined,
    maxDepth: query.maxDepth ? Number(query.maxDepth) : undefined
  };
}

export default calls;
