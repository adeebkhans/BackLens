import { IDatabase, IStatement } from "./IDatabase";

// Defines the structure of an edge object ready to be persisted to the database
export type PersistEdge = {
  from: string;          // The stable ID of the source node (caller, container)
  to: string;            // The stable ID of the target node (callee, contained)
  type: string;          // The type of relationship ("call", "contains", "imports")
  meta?: Record<string, any> | null; // metadata object
};

// --- EdgeStore Class Definition ---

// The class responsible for all interactions with the 'edges' table
export class EdgeStore {
  db: IDatabase;      // Property to hold the active database connection
  insertStmt: IStatement; // Prepared statement for inserting/updating edges (upsert)

  // Constructor takes the active database connection instance
  constructor(db: IDatabase) {
    this.db = db;

    // Prepare the SQL statement for UPSERT (Insert or Update)
    this.insertStmt = db.prepare(`
      INSERT INTO edges (from_id, to_id, type, meta)
      VALUES (:from, :to, :type, :meta)
      ON CONFLICT(from_id, to_id, type) DO UPDATE SET meta = excluded.meta
      -- ON CONFLICT uses the UNIQUE constraint (from_id, to_id, type) defined.
      -- If the edge already exists, update only the 'meta' data.
    `);
  }

  /**
   * Inserts a new edge or updates an existing one (UPSERT operation).
   * @param e The PersistEdge object to save.
   */
  upsert(e: PersistEdge) {
    // Convert the complex 'meta' object into a JSON string, or set to null if missing
    const metaStr = e.meta ? JSON.stringify(e.meta) : null;

    // Execute the prepared INSERT statement. Uses named parameters (@from, @to, @type, @meta).
    this.insertStmt.run({ from: e.from, to: e.to, type: e.type, meta: metaStr });
  }

  // --- Convenience Query Methods ---

  /**
   * Retrieves all edges originating from a specific source node.
   * @param fromId The stable ID of the source node.
   * @returns An array of edge rows.
   */
  getEdgesFrom(fromId: string) {
    // Prepare and execute a SELECT statement to find all relationships starting at fromId
    return this.db.prepare(`SELECT * FROM edges WHERE from_id = ?`).all(fromId);
  }

  /**
   * Retrieves all edges terminating at a specific target node.
   * @param toId The stable ID of the target node.
   * @returns An array of edge rows.
   */
  getEdgesTo(toId: string) {
    // Prepare and execute a SELECT statement to find all relationships ending at toId (i.e., all callers)
    return this.db.prepare(`SELECT * FROM edges WHERE to_id = ?`).all(toId);
  }
}