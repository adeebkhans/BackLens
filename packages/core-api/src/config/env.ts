import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// From packages/core-api/src/config/ up to packages/, then to graph-store/
const defaultDbPath = resolve(__dirname, "../../..", "graph-store/graph.db");

export const config = {
  port: Number(process.env.PORT || 4000),
  host: process.env.HOST || "0.0.0.0",
  graphDbPath: process.env.GRAPH_DB || defaultDbPath,
  nodeEnv: process.env.NODE_ENV || "development",
  logLevel: process.env.LOG_LEVEL || "info"
};

export type Config = typeof config;
