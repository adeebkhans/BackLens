/**
 * Analytics routes - Hotspot detection and metrics
 * Enhanced with Object-Aware Semantic Analysis statistics
 */
import { FastifyPluginAsync } from "fastify";
import type { HotspotsQueryParams } from "../types.js";

const analytics: FastifyPluginAsync = async (app: any) => {
    /**
     * GET /analytics/hotspots
     * Get most connected nodes (high fan-in × fan-out)
     * ?top=20&expanded=true&includeTypes=function
     */
    app.get("/hotspots", async (req: any) => {
        const { top, ...queryOpts } = req.query as HotspotsQueryParams;

        const opts = {
            ...parseQueryOptions(queryOpts),
            top: top ? Number(top) : 20
        };

        const results = app.graph.hotspots(opts);

        return {
            success: true,
            data: results,
            meta: {
                count: results.length,
                top: opts.top,
                sortedBy: "score (in * out)"
            }
        };
    });

    /**
     * GET /analytics/stats
     * Get overall graph statistics
     */
    app.get("/stats", async () => {
        const stats = app.graph.getStats ? app.graph.getStats() : null;

        if (stats) {
            return {
                success: true,
                data: stats
            };
        }

        return {
            success: true,
            data: {
                message: "Graph statistics endpoint - to be implemented",
                suggestion: "Add getStats() method to GraphAPI"
            }
        };
    });

    /**
     * GET /analytics/semantic-stats
     * Get semantic analysis statistics (classes, methods, framework calls)
     */
    app.get("/semantic-stats", async () => {
        try {
            const stats = app.graph.getSemanticStats();

            return {
                success: true,
                data: stats
            };
        } catch (error) {
            return {
                success: false,
                error: 'Failed to compute semantic stats'
            };
        }
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

export default analytics;
