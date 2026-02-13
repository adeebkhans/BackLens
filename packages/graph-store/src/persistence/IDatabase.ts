/**
 * Database interface that abstracts SQLite implementation.
 * Allows swapping between native better-sqlite3 (for performance) 
 * and WASM sql.js (for portability in VS Code extensions).
 */
export interface IDatabase {
  /**
   * Prepare a SQL statement for repeated execution.
   */
  prepare(sql: string): IStatement;

  /**
   * Execute one or more SQL statements without returning results.
   */
  exec(sql: string): void;

  /**
   * Close the database connection.
   */
  close(): void;

  /**
   * Reset schema: Drop and recreate tables.
   * Used in write workflows to ensure clean state.
   */
  resetSchema?(): void;

  /**
   * Persist changes to disk (relevant for WASM).
   * Called automatically in close() but exposed for manual control.
   */
  save?(): void;
}

/**
 * Prepared statement interface for executing parameterized queries.
 */
export interface IStatement {
  /**
   * Execute the statement with the given parameters.
   * For INSERT/UPDATE/DELETE operations.
   */
  run(...params: any[]): IRunResult;

  /**
   * Execute the statement and return the first matching row.
   */
  get(...params: any[]): any;

  /**
   * Execute the statement and return all matching rows.
   */
  all(...params: any[]): any[];
}

/**
 * Result of a run() operation.
 */
export interface IRunResult {
  changes: number;
  lastInsertRowid: number | bigint;
}

/**
 * Factory function type for creating database instances.
 */
export type DatabaseFactory = (dbPath: string) => IDatabase | Promise<IDatabase>;