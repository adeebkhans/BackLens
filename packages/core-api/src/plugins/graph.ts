/**
 * GraphAPI Plugin - Provides singleton GraphAPI instance to all routes
 */
import fp from "fastify-plugin";
import { createGraphAPI, type GraphAPI } from "@backlens/graph-store";
import { config } from "../config/env.js";

// Extend FastifyInstance to include graph property
declare module "fastify" {
  interface FastifyInstance {
    graph: GraphAPI;
  }
}

// GraphAPI plugin (High-order function)
export default fp(async (app: any) => {
  const dbPath = config.graphDbPath;
  
  app.log.info(`Initializing GraphAPI with database: ${dbPath}`);

  const graph = await createGraphAPI(dbPath);

  // Decorate Fastify instance with graph API
  app.decorate("graph", graph);

  // Clean shutdown: close DB connection when server stops
  app.addHook("onClose", async () => {
    app.log.info("Closing GraphAPI connection...");
    graph.close();
  });
}, {
  name: "graph-plugin"
});