import Fastify from "fastify";
import cors from "@fastify/cors";
import { config } from "./config/env.js";

// Plugins
import graphPlugin from "./plugins/graph.js";

// Routes
import healthRoutes from "./routes/health.js";
import nodeRoutes from "./routes/nodes.js";
import callRoutes from "./routes/calls.js";
import traversalRoutes from "./routes/traversal.js";
import analyticsRoutes from "./routes/analytics.js";

export function buildApp() {
  const app = Fastify({
    logger: config.nodeEnv === "development" ? {
      level: config.logLevel
    } : {
      level: config.logLevel
    }
  });

  // Register CORS
  app.register(cors, {
    origin: config.nodeEnv === "development" ? true : false, // allow all origins in development
    credentials: true
  });

  // Register GraphAPI plugin (provides app.graph)
  app.register(graphPlugin);

  // Register route handlers
  app.register(healthRoutes, { prefix: "/health" });
  app.register(nodeRoutes, { prefix: "/nodes" });
  app.register(callRoutes, { prefix: "/calls" });
  app.register(traversalRoutes, { prefix: "/traversal" });
  app.register(analyticsRoutes, { prefix: "/analytics" });

  // Root route
  app.get("/", async () => ({
    name: "@backlens/core-api",
    version: "0.1.0",
    endpoints: {
      health: "/health",
      nodes: "/nodes",
      calls: "/calls",
      traversal: "/traversal",
      analytics: "/analytics"
    },
    docs: "https://github.com/adeebkhans/backlens"
  }));

  // Global error handler
  app.setErrorHandler((error: any, request: any, reply: any) => {
    app.log.error(error);

    reply.status(error.statusCode || 500).send({
      success: false,
      error: {
        message: error.message || "Internal Server Error",
        code: error.code || "INTERNAL_ERROR"
      }
    });
  });

  return app;
}