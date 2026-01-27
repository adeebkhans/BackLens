/**
 * Health check routes
 */
import { FastifyPluginAsync } from "fastify";

const health: FastifyPluginAsync = async (app: any) => {
  app.get("/", async () => {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: "0.1.0"
    };
  });

  app.get("/ready", async () => {
    // Check if graph DB is accessible
    try {
      const testNode = app.graph.searchNodes("test");
      return {
        status: "ready",
        graphDb: "connected"
      };
    } catch (error) {
      return {
        status: "not ready",
        graphDb: "disconnected",
        error: error instanceof Error ? error.message : "unknown error"
      };
    }
  });
};

export default health;
