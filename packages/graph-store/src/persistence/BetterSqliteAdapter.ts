import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import type { IDatabase, IStatement, IRunResult } from "./IDatabase";

/**
 * Ensures the directory containing the given path 'p' exists. Creates it recursively if missing.
 * @param p The full path to the file (the database file).
 */
function ensureDirExists(p: string) {
    const dir = path.dirname(p);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/**
 * Wrapper around better-sqlite3 Statement to match IStatement interface.
 */
class BetterSqliteStatement implements IStatement {
    constructor(private stmt: Database.Statement) { }

    run(...params: any[]): IRunResult {
        const result = this.stmt.run(...params);
        return {
            changes: result.changes,
            lastInsertRowid: result.lastInsertRowid
        };
    }

    get(...params: any[]): any {
        return this.stmt.get(...params);
    }

    all(...params: any[]): any[] {
        return this.stmt.all(...params);
    }
}

/**
 * Native better-sqlite3 adapter.
 * Use this for CLI, server, and high-performance scenarios.
 * 
 * NOTE: This adapter uses native C++ bindings and requires compilation
 * for the specific Node.js version. Hence not suitable for VS Code extensions.
 */
export class BetterSqliteAdapter implements IDatabase {
    private db: Database.Database;

    constructor(dbPath: string) {
        ensureDirExists(dbPath);
        this.db = new Database(dbPath);
        this.ensureSchema(); // Schema Creation (if missing)
    }

    /**
    * Create schema if missing (nodes and edges tables).
    */
    private ensureSchema(): void {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS nodes (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        label TEXT,
        meta TEXT
      );
     `);

        this.db.exec(`
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
        this.db.exec(`CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type);`);
        this.db.exec(`CREATE INDEX IF NOT EXISTS idx_edges_from ON edges(from_id);`);
        this.db.exec(`CREATE INDEX IF NOT EXISTS idx_edges_to ON edges(to_id);`);
    }

    prepare(sql: string): IStatement {
        return new BetterSqliteStatement(this.db.prepare(sql));
    }

    exec(sql: string): void {
        this.db.exec(sql);
    }

    close(): void {
        this.db.close();
    }

    /**
     * Destructive reset - drops and recreates tables.
     */
    resetSchema(): void {
        this.db.exec(`DROP TABLE IF EXISTS edges;`);
        this.db.exec(`DROP TABLE IF EXISTS nodes;`);
        this.ensureSchema();
    }

    /**
     * Get the underlying better-sqlite3 database instance (if needed).
     */
    getRawDb(): Database.Database {
        return this.db;
    }
}

/**
 * Factory function to create a BetterSqliteAdapter.
 */
export function createBetterSqliteAdapter(dbPath: string): IDatabase {
    return new BetterSqliteAdapter(dbPath);
}