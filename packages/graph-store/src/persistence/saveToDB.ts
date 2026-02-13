import type { Graph } from "../core-ir-processor/types";
import { BetterSqliteAdapter } from "./BetterSqliteAdapter"; // Native SQLite adapter
import { WasmSqliteAdapter } from "./WasmSqliteAdapter"; // WebAssembly SQLite adapter for VS Code extension
import { NodeStore } from "./NodeStore";
import { EdgeStore } from "./EdgeStore";
import type { IDatabase } from "./IDatabase"; // Common interface for both adapters

/* ============================================================
   SQLite PERSISTENCE LAYER (Graph.json to Graph.db)
   ============================================================*/

/**
 * Unified save function that works with any IDatabase adapter.
 * - Call with useWasm=false for CLI/server (better-sqlite3)
 * - Call with useWasm=true for VS Code extension (sql.js WASM)
 */
export async function saveGraphToDb(
    graph: Graph,
    dbPath: string,
    useWasm: boolean = false
): Promise<void> {

    let db: IDatabase;

    if (useWasm) {
        db = await WasmSqliteAdapter.create(dbPath); // await becuase WASM binaries load asynchronously 
    } else {
        db = new BetterSqliteAdapter(dbPath); // new as Native C++ bindings load synchronously and instantly.
    }

    try {
        // 1. --- Reset Schema (Clear old data) ---
        if (db.resetSchema) { // check if interface method exists in implementation of adapter
            db.resetSchema();
        } else { // fallback
            db.exec(`DROP TABLE IF EXISTS edges;`);
            db.exec(`DROP TABLE IF EXISTS nodes;`);
        }

        // Initialize Stores helper classes
        const nodeStore = new NodeStore(db);
        const edgeStore = new EdgeStore(db);

        // 2. --- Transactional Write ---
        // We use the try/catch with BEGIN/COMMIT. This is a "Soft Transaction" pattern:
        // A. Native (CLI/Server): Transactions are CRITICAL for performance. Without 'BEGIN', 
        //    every node insert triggers a slow disk write (1000 nodes, 1000 writes). This batches them into one.
        // B. WASM (VS Code): Runs entirely in memory. sql.js can handle transactions differently
        //    or throw errors on nested locks. So it saves extension crashes. Since it's RAM-only, the 
        //    performance penalty of missing the transaction is negligible.
        // This allows us to have 100x speed in CLI/Server while remaining crash-safe in VS Code.
        try {
            db.exec("BEGIN");
        } catch (err) {
            // Ignore transaction errors in WASM; atomicity is less critical for in-memory builds
        }

        try {
            for (const n of graph.nodes) {
                nodeStore.upsert({
                    id: n.id,
                    type: n.type,
                    label: n.label,
                    meta: n.meta ?? null
                });
            }

            for (const e of graph.edges) {
                edgeStore.upsert({
                    from: e.from,
                    to: e.to,
                    type: e.type,
                    meta: e.meta ?? null
                });
            }

            try {
                db.exec("COMMIT");
            } catch (err) {
                // Ignore commit errors in WASM
            }
        } catch (err) {
            try {
                db.exec("ROLLBACK");
            } catch (rollbackErr) {
                // Ignore rollback errors
            }
            throw err;
        }
    } finally {
        // 3. Close (and flush to disk for WASM)
        // For Native: Closes file handle.
        // For WASM: Critical - writes the RAM buffer to the actual graph.db file on disk
        db.close();
    }
}

/**
 * Convenience export: Save with native SQLite adapter (synchronous)
 * Use this in CLI/server environments.
 */
export async function saveGraph(graph: Graph, dbPath: string): Promise<void> {
    return saveGraphToDb(graph, dbPath, false);
}

/**
 * Convenience export: Save with WASM SQLite adapter (async)
 * Use this in VS Code extension environments.
 */
export async function saveGraphWasm(graph: Graph, dbPath: string): Promise<void> {
    return saveGraphToDb(graph, dbPath, true);
}