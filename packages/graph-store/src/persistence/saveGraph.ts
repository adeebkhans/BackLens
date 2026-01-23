import type { Graph } from "../core-ir-processor/types";
import { openDb, resetSchema } from "./db";
import { NodeStore } from "./NodeStore";
import { EdgeStore } from "./EdgeStore";

/* ============================================================
   SQLite PERSISTENCE LAYER
   ============================================================*/

export function saveGraph(graph: Graph, dbPath: string) {
  const db = openDb(dbPath);
  // IMPORTANT: write workflow must clear stale state; read/query workflows must not.
  resetSchema(db);
  const nodes = new NodeStore(db);
  const edges = new EdgeStore(db);

  const insert = db.transaction((graph: Graph) => {
    graph.nodes.forEach(n =>
      nodes.upsert({
        id: n.id,
        type: n.type,
        label: n.label,
        meta: n.meta ?? null
      })
    );

    graph.edges.forEach(e =>
      edges.upsert({
        from: e.from,
        to: e.to,
        type: e.type,
        meta: e.meta ?? null
      })
    );
  });

  insert(graph);
  db.close();
}
