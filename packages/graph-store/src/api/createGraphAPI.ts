import { GraphAPI } from "./GraphAPI";
import { GraphAPIImpl } from "./GraphAPIImpl";
import { BetterSqliteAdapter } from "../persistence/BetterSqliteAdapter";
import { WasmSqliteAdapter } from "../persistence/WasmSqliteAdapter";
import { NodeStore } from "../persistence/NodeStore";
import { EdgeStore } from "../persistence/EdgeStore";
import { IDatabase } from "../persistence/IDatabase";

/**
 * Factory for GraphAPI from a database instance.
 * Use this when you have already created a database adapter.
 */
export function createGraphAPIFromDb(db: IDatabase): GraphAPI {
  const nodeStore = new NodeStore(db);
  const edgeStore = new EdgeStore(db);
  return new GraphAPIImpl(db, nodeStore, edgeStore);
}

/**
 * Factory for GraphAPI. Decides which database adapter to initialize.
 */
export async function createGraphAPI(
  dbPath: string, 
  useWasm: boolean = false): Promise<GraphAPI> {
  
  let db: IDatabase;

  if (useWasm) {
    // VS Code / Browser: Async create
    db = await WasmSqliteAdapter.create(dbPath);
  } else {
    // CLI / Server: Sync create
    db = new BetterSqliteAdapter(dbPath);
  }

  return createGraphAPIFromDb(db);
}