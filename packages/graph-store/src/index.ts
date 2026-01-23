import fs from "fs";
import path from "path";

import type { IR } from "./core-ir-processor/buildGraph";
import { buildGraph } from "./core-ir-processor/buildGraph";
import type { Graph } from "./core-ir-processor/types";
import { saveGraph } from "./persistence/saveGraph";

/**
 * Programmatic Export
 */
export { buildGraph };
export type { IR };
export { saveGraph };
export { createGraphAPI } from "./api/createGraphAPI";
export type { GraphNode, ExpandedNode, GraphAPI } from "./api/GraphAPI";
export type { QueryOptions } from "./api/QueryOptions";

/* ============================================================
   CLI ENTRY
   Supports TWO commands:
   1. Build graph.json from ir.json:
      node index.js build-ir <ir.json> [out.json]

   2. Save graph.json into SQLite:
      node index.js save-sqlite <graph.json> [graph.db]
   ============================================================*/

async function cliMain() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error(`
Usage:
  Build graph.json from ir.json:
    node -r ts-node/register src/index.ts build-ir <ir.json> [out.json]

  Save graph.json → graph.db:
    node -r ts-node/register src/index.ts save-sqlite <graph.json> [graph.db]
`);
    process.exit(1);
  }

  const mode = args[0];

  /* ---------------------- MODE 1: build-ir ---------------------- */
  if (mode === "build-ir") {
    const inPath = path.resolve(args[1]);
    // Force output to be in the current working directory (graph-store)
    const outPath = args[2]
      ? path.resolve(process.cwd(), path.basename(args[2]))
      : path.resolve(process.cwd(), "graph.json");

    if (!fs.existsSync(inPath)) {
      console.error("IR file not found:", inPath);
      process.exit(1);
    }

    const raw = fs.readFileSync(inPath, "utf8");
    let ir: IR;

    try {
      ir = JSON.parse(raw);
    } catch (err) {
      console.error("Failed to parse IR JSON:", err);
      process.exit(1);
    }

    const graph = buildGraph(ir);
    fs.writeFileSync(outPath, JSON.stringify(graph, null, 2), "utf8");

    console.log(`graph.json written to ${outPath}`);
    return;
  }

  /* --------------------- MODE 2: save-sqlite -------------------- */
  if (mode === "save-sqlite") {
    const graphPath = path.resolve(args[1]);
    // Force output to be in the current working directory (graph-store)
    const dbPath = args[2]
      ? path.resolve(process.cwd(), path.basename(args[2]))
      : path.resolve(process.cwd(), "graph.db");

    if (!fs.existsSync(graphPath)) {
      console.error("graph.json not found:", graphPath);
      process.exit(1);
    }

    const raw = fs.readFileSync(graphPath, "utf8");
    let graph: Graph;

    try {
      graph = JSON.parse(raw);
    } catch (err) {
      console.error("Failed to parse graph.json:", err);
      process.exit(1);
    }

    console.log("Saving into SQLite:", dbPath);
    saveGraph(graph, dbPath);
    console.log("SQLite graph saved:", dbPath);
    return;
  }

  console.error("Unknown command:", mode);
  process.exit(1);
}

if (require.main === module) {
  cliMain().catch(err => {
    console.error("Fatal:", err);
    process.exit(1);
  });
}

// run -
// pnpm --filter graph-store dev -- build-ir ../parser/ir.json graph.json
// pnpm --filter graph-store dev -- save-sqlite graph.json graph.db