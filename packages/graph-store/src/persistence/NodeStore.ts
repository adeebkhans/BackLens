import Database from "better-sqlite3";

// Defines the structure of a node object ready to be persisted to the database
export type PersistNode = {
  id: string;
  type: string;
  label?: string;
  meta?: Record<string, any> | null;
};

// Define the shape of the row returned from SQLite SELECT query
type NodeRow = {
  id: string;
  type: string;
  label: string | null;
  meta: string | null;
};

// --- NodeStore Class Definition ---

// The class responsible for all interactions with the 'nodes' table
export class NodeStore {
  db: Database.Database;      // Property to hold the active database connection
  insertStmt: Database.Statement; // Prepared statement for inserting/updating nodes (upsert)
  selectStmt: Database.Statement; // Prepared statement for selecting a node by ID

  // Constructor takes the active database connection instance
  constructor(db: Database.Database) {
    this.db = db;

    // Prepare the SQL statement for UPSET (Insert or Update)
    this.insertStmt = db.prepare(`
      INSERT INTO nodes (id, type, label, meta)
      VALUES (@id, @type, @label, @meta)
      ON CONFLICT(id) DO UPDATE SET       -- If a node with the same 'id' already exists...
      type=excluded.type,                 -- ...update the 'type' field
      label=excluded.label,               -- ...update the 'label' field
      meta=excluded.meta                  -- ...update the 'meta' field
    `);

    // Prepare the SQL statement for retrieving a single node by its ID
    this.selectStmt = db.prepare(`SELECT id, type, label, meta FROM nodes WHERE id = ?`);
  }

  // --- Data Access Methods ---

  /**
   * Inserts a new node or updates an existing one (UPSERT operation).
   * @param node The PersistNode object to save.
   */
  upsert(node: PersistNode) {
    // Convert the complex 'meta' object into a JSON string, or set to null if missing
    const metaStr = node.meta ? JSON.stringify(node.meta) : null;

    // Execute the prepared INSERT statement. Uses named parameters (@id, @type, etc.)
    this.insertStmt.run({
      id: node.id,
      type: node.type,
      label: node.label || null, // Ensure label is null if it's undefined/empty
      meta: metaStr
    });
  }

  /**
   * Retrieves a node by its ID and deserializes the metadata.
   * @param id The stable ID of the node to retrieve.
   * @returns The reconstituted PersistNode object, or null if not found.
   */
  get(id: string): PersistNode | null {
    // Execute the prepared SELECT statement. Cast the result to the expected NodeRow type.
    const row = this.selectStmt.get(id) as NodeRow | undefined;

    // If no row was returned, the node doesn't exist
    if (!row) return null;

    // Reconstruct and return the PersistNode object
    return {
      id: row.id,
      type: row.type,
      label: row.label || undefined,
      meta: row.meta ? JSON.parse(row.meta) : null // Parse the JSON string back into an object
    };
  }
}