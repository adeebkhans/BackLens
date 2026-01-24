import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

// --- Helper Functions ---

/**
 * Ensures the directory containing the given path 'p' exists. Creates it recursively if missing.
 * @param p The full path to the file (the database file).
 */
export function ensureDirExists(p: string) {
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/**
 * Open a SQLite DB (synchronous). Creates schema if missing.
 * @param dbPath path to sqlite file
 */
export function openDb(dbPath: string): Database.Database {
  ensureDirExists(dbPath);

  // Instantiate and open the database connection. The file is created if it does not exist.
  const db = new Database(dbPath);

  // --- Schema Creation (if missing) ---
  ensureSchema(db);

  return db;
}

/**
 * Create schema if missing
 */
export function ensureSchema(db: Database.Database) {
  // Execute SQL command to create the 'nodes' table
  // The nodes table stores unique entities in the graph (functions, files, external modules, etc.)
  db.exec(`
    CREATE TABLE IF NOT EXISTS nodes (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      label TEXT,
      meta TEXT
    );
  `);

  // Execute SQL command to create the 'edges' table
  // The edges table stores relationships between nodes (calls, contains, imports)
  db.exec(`
    CREATE TABLE IF NOT EXISTS edges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_id TEXT NOT NULL,
      to_id TEXT NOT NULL,
      type TEXT NOT NULL,
      meta TEXT,
      UNIQUE(from_id, to_id, type)
    );
  `);

  // --- Index Creation for Query Optimization ---
  db.exec(`CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_edges_from ON edges(from_id);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_edges_to ON edges(to_id);`);
}

/**
 * Destructive reset used by the write workflow to prevent stale/ghost nodes.
 */
export function resetSchema(db: Database.Database) {
  // Drop edges first due to FK/ordering expectations.
  db.exec(`DROP TABLE IF EXISTS edges;`);
  db.exec(`DROP TABLE IF EXISTS nodes;`);
  ensureSchema(db);
}