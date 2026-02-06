import type { IDatabase, IStatement, IRunResult } from "./IDatabase";

// sql.js types (dynamic import)
type SqlJsDatabase = any;
type SqlJsStatement = any;

/**
 * Wrapper around sql.js Statement to match IStatement interface.
 * sql.js uses a different API than better-sqlite3, so we adapt it here.
 * sql.js requires manual  memory management (freeing statements), which we handle in this wrapper.
 * We also normalize parameter binding to support both positional and named parameters.
 */
class WasmStatement implements IStatement {
    private db: SqlJsDatabase;
    private sql: string;

    constructor(db: SqlJsDatabase, sql: string) {
        this.db = db;
        this.sql = sql;
    }

    run(...params: any[]): IRunResult {
        // Handle named parameters (objects) vs positional parameters
        const bindParams = this.normalizeParams(params);

        const stmt = this.db.prepare(this.sql);
        stmt.bind(bindParams);
        stmt.step(); // Execute the query
        stmt.free(); // CRITICAL: Free WASM memory immediately

        // sql.js doesn't return changes/lastInsertRowid directly from run
        // We need to query for it
        const changesResult = this.db.exec("SELECT changes() as changes, last_insert_rowid() as lastId");
        const changes = changesResult.length > 0 ? changesResult[0].values[0][0] : 0;
        const lastId = changesResult.length > 0 ? changesResult[0].values[0][1] : 0;

        return {
            changes: changes as number,
            lastInsertRowid: lastId as number
        };
    }

    get(...params: any[]): any {
        const bindParams = this.normalizeParams(params);
        const stmt = this.db.prepare(this.sql);
        stmt.bind(bindParams);

        // Execute and get first row
        if (stmt.step()) {
            const row = stmt.getAsObject(); // Convert internal C-struct to JS Object
            stmt.free();
            return row;
        }
        stmt.free();
        return undefined;
    }

    all(...params: any[]): any[] {
        const bindParams = this.normalizeParams(params);
        const results: any[] = [];
        const stmt = this.db.prepare(this.sql);
        stmt.bind(bindParams);
        // Execute and get all rows
        while (stmt.step()) {
            results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
    }

    /**
     * Normalize parameters to sql.js format.
     * Handles both positional (array) and named (object) parameters.
     * sql.js bind() expects named params with : prefix (e.g., {":id": value})
     */
    private normalizeParams(params: any[]): any {
        if (params.length === 0) return [];

        // If first param is an object with keys (named params), convert to sql.js format
        if (params.length === 1 && typeof params[0] === 'object' && params[0] !== null && !Array.isArray(params[0])) {
            const obj = params[0];
            const sqlJsParams: Record<string, any> = {};

            // sql.js bind() expects parameter names with : prefix
            for (const [key, value] of Object.entries(obj)) {
                sqlJsParams[`:${key}`] = value;
            }
            return sqlJsParams;
        }

        // Positional parameters - return as array
        return params;
    }
}

/**
 * WASM-based SQLite adapter using sql.js.
 * This adapter is portable and doesn't require native compilation,
 * making it ideal for cross-platform VS Code extensions.
 */
export class WasmSqliteAdapter implements IDatabase {
    private db: SqlJsDatabase;
    private filePath: string;
    private fs: typeof import('fs') | null = null;
    private dirty: boolean = false;

    private constructor(db: SqlJsDatabase, filePath: string, fs: typeof import('fs') | null) {
        this.db = db;
        this.filePath = filePath;
        this.fs = fs;
    }

    /**
     * Create a new WasmSqliteAdapter instance.
     * This is async because sql.js needs to be dynamically imported and initialized.
     */
    static async create(filePath: string): Promise<WasmSqliteAdapter> {
        // Dynamic import of sql.js
        const initSqlJs = (await import('sql.js')).default;

        // Try to load fs for Node.js environments first
        let fs: typeof import('fs') | null = null;
        let pathModule: typeof import('path') | null = null;
        let buffer: Uint8Array | undefined;

        try {
            fs = await import('fs');
            pathModule = await import('path');

            // Ensure directory exists
            const dir = pathModule.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            // Load existing database if it exists
            if (fs.existsSync(filePath)) {
                buffer = fs.readFileSync(filePath);
            }
        } catch { 
            fs = null;
        }

        // Initialize sql.js with WASM binary from node_modules
        let SQL: any;
        let wasmBinary: ArrayBuffer | undefined;

        if (fs && pathModule) {
            // Try to find WASM in node_modules using require.resolve
            try {
                const wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm');
                const wasmBuffer = fs.readFileSync(wasmPath);
                wasmBinary = wasmBuffer.buffer.slice(wasmBuffer.byteOffset, wasmBuffer.byteOffset + wasmBuffer.byteLength); // Node js buffer to JS Array buffer
            } catch (err) {
                // Fallback: Check common locations
                const possiblePaths = [
                    pathModule.join(__dirname, 'sql-wasm.wasm'),
                    pathModule.join(__dirname, '..', 'sql-wasm.wasm'),
                    pathModule.join(__dirname, '..', '..', 'dist', 'sql-wasm.wasm'),
                ];

                for (const p of possiblePaths) {
                    if (fs.existsSync(p)) {
                        const wasmBuffer = fs.readFileSync(p);
                        wasmBinary = wasmBuffer.buffer.slice(wasmBuffer.byteOffset, wasmBuffer.byteOffset + wasmBuffer.byteLength);
                        break;
                    }
                }
            }
        }

        // Initialize with WASM binary
        if (wasmBinary) {
            // Boots the SQLite engine using the binary data found. This is the moment the database engine starts running in memory
            SQL = await initSqlJs({ wasmBinary });
        } else {
            throw new Error('Could not locate sql-wasm.wasm file');
        }

        const db = new SQL.Database(buffer);
        const adapter = new WasmSqliteAdapter(db, filePath, fs);
        adapter.ensureSchema();

        return adapter;
    }

    private ensureSchema(): void {
        this.db.run(`
      CREATE TABLE IF NOT EXISTS nodes (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        label TEXT,
        meta TEXT
      );
    `);

        this.db.run(`
      CREATE TABLE IF NOT EXISTS edges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_id TEXT NOT NULL,
        to_id TEXT NOT NULL,
        type TEXT NOT NULL,
        meta TEXT,
        UNIQUE(from_id, to_id, type)
      );
    `);

        this.db.run(`CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type);`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_edges_from ON edges(from_id);`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_edges_to ON edges(to_id);`);

        this.save(); // CRITICAL: Save immediately after creating tables
    }

    prepare(sql: string): IStatement {
        return new WasmStatement(this.db, sql);
    }

    exec(sql: string): void {
        this.db.run(sql);
        this.dirty = true; // Mark as "needs saving"
        this.save(); // Save immediately after execution
    }

    close(): void {
        this.save();
        this.db.close();
    }

    /**
     * Save the in-memory database to disk (if fs is available).
     * sql.js operates in-memory, so we need to manually persist changes.
     */
    save(): void {
        if (this.fs && this.filePath) {
            try {
                const data = this.db.export();
                this.fs.writeFileSync(this.filePath, Buffer.from(data));
                this.dirty = false;
            } catch (err) {
                console.error('Failed to save database:', err);
            }
        }
    }

    /**
     * Destructive reset - drops and recreates tables.
     */
    resetSchema(): void {
        this.db.run(`DROP TABLE IF EXISTS edges;`);
        this.db.run(`DROP TABLE IF EXISTS nodes;`);
        this.ensureSchema();
    }

    /**
     * Get the raw database data as a Uint8Array.
     * Useful for transferring the database.
     */
    export(): Uint8Array {
        return this.db.export();
    }
}

/**
 * Factory function to create a WasmSqliteAdapter.
 * Returns a Promise because initialization is async.
 */
export async function createWasmSqliteAdapter(dbPath: string): Promise<IDatabase> {
    return WasmSqliteAdapter.create(dbPath);
}
