/**
 * Node query routes - Get node metadata and search
 */
import { FastifyPluginAsync } from "fastify";

const nodes: FastifyPluginAsync = async (app: any) => {
  /**
   * GET /nodes/:id
   * Get a single node by its stable ID
   */
  app.get("/:id", async (req: any, reply: any) => {
    const { id } = req.params;
    const node = app.graph.getNode(id);
    
    if (!node) {
      return reply.code(404).send({
        success: false,
        error: { message: "Node not found", code: "NODE_NOT_FOUND" }
      });
    }
    
    return { success: true, data: node };
  });

  /**
   * GET /nodes?q=searchTerm&includeTypes=class,method
   * Search for nodes by ID or label (fuzzy search)
   * Supports filtering by node types
   */
  app.get("/", async (req: any) => {
    const { q, limit = 100, includeTypes, excludeTypes } = req.query;
    
    // Parse type filters
    const typeFilters = {
      includeTypes: includeTypes ? includeTypes.split(",") : undefined,
      excludeTypes: excludeTypes ? excludeTypes.split(",") : undefined
    };
    
    // If no query but type filter is provided, return all nodes of that type
    if (!q && (typeFilters.includeTypes || typeFilters.excludeTypes)) {
      const allNodes = app.graph.getAllNodes ? app.graph.getAllNodes(typeFilters) : [];
      const limited = allNodes.slice(0, limit);
      
      return {
        success: true,
        data: limited,
        meta: {
          total: allNodes.length,
          returned: limited.length,
          filters: typeFilters
        }
      };
    }
    
    if (!q) {
      return {
        success: true,
        data: [],
        message: "Provide 'q' query parameter to search, or 'includeTypes' to list nodes by type"
      };
    }
    
    const results = app.graph.searchNodes(q, typeFilters);
    const limited = results.slice(0, limit);
    
    return {
      success: true,
      data: limited,
      meta: {
        total: results.length,
        returned: limited.length,
        query: q,
        filters: typeFilters
      }
    };
  });
};

export default nodes;
