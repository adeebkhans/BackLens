import { IDatabase } from "../persistence/IDatabase";

/**
 * Small helpers that query the edges table to get direct neighbors.
 * The functions are synchronous and lightweight (using prepared statements).
 */

export function createTraversalHelpers(db: IDatabase) {
  // prepared statements
  const getIncoming = db.prepare(`SELECT from_id, to_id, type, meta FROM edges WHERE to_id = ?`);
  const getOutgoing = db.prepare(`SELECT from_id, to_id, type, meta FROM edges WHERE from_id = ?`);

  function immediateCallers(nodeId: string) {
    return getIncoming.all(nodeId) as { from_id: string; to_id: string; type: string; meta: string | null }[];
  }

  function immediateCallees(nodeId: string) {
    return getOutgoing.all(nodeId) as { from_id: string; to_id: string; type: string; meta: string | null }[];
  }

  return {
    immediateCallers,
    immediateCallees
  };
}

/**
 * Build a flat set of transitive callers (ancestors) using BFS.
 * Returns array of node ids (excluding the start node).
 */
export function transitiveCallersFlat(db: IDatabase, startId: string, maxDepth = 200) {
  const { immediateCallers } = createTraversalHelpers(db);
  const visited = new Set<string>();
  const queue: { id: string; depth: number }[] = [{ id: startId, depth: 0 }];
  visited.add(startId);

  const result: string[] = [];

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    if (depth >= maxDepth) continue;
    const incoming = immediateCallers(id);
    for (const row of incoming) {
      const p = row.from_id;
      if (!visited.has(p)) {
        visited.add(p);
        result.push(p);
        queue.push({ id: p, depth: depth + 1 });
      }
    }
  }
  return result;
}

/**
 * Build a flat set of transitive callees using BFS.
 */
export function transitiveCalleesFlat(db: IDatabase, startId: string, maxDepth = 200) {
  const { immediateCallees } = createTraversalHelpers(db);
  const visited = new Set<string>();
  const queue: { id: string; depth: number }[] = [{ id: startId, depth: 0 }];
  visited.add(startId);

  const result: string[] = [];

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    if (depth >= maxDepth) continue;
    const outgoing = immediateCallees(id);
    for (const row of outgoing) {
      const t = row.to_id;
      if (!visited.has(t)) {
        visited.add(t);
        result.push(t);
        queue.push({ id: t, depth: depth + 1 });
      }
    }
  }
  return result;
}

/**
 * Build a tree structure for callers:
 * Node: { id, children: [...] }
 * Children are callers of the node.
 */
export function transitiveCallersTree(db: IDatabase, startId: string, maxDepth = 50) {
  const { immediateCallers } = createTraversalHelpers(db);
  const visited = new Set<string>();

  function build(nodeId: string, depth: number) {
    if (depth > maxDepth) return { id: nodeId, children: [] };
    const children: any[] = [];
    const incoming = immediateCallers(nodeId);
    for (const row of incoming) {
      const pid = row.from_id;
      if (visited.has(pid)) {
        // include node but don't recurse (Cycle-safe: tracks visited set and stops revisiting)
        children.push({ id: pid, children: [] });
      } else {
        visited.add(pid);
        children.push(build(pid, depth + 1));
      }
    }
    return { id: nodeId, children };
  }

  visited.add(startId);
  const tree = build(startId, 0);
  // We usually want the tree rooted at callers, not the start node as the root's only child,
  // but keeping the start as root is more generic for building a callers tree for a node.
  return tree;
}

/**
 * Build a tree structure for callees (outgoing).
 * Node: { id, children: [...] }
 */
export function transitiveCalleesTree(db: IDatabase, startId: string, maxDepth = 50) {
  const { immediateCallees } = createTraversalHelpers(db);
  const visited = new Set<string>();

  function build(nodeId: string, depth: number) {
    if (depth > maxDepth) return { id: nodeId, children: [] };
    const children: any[] = [];
    const outgoing = immediateCallees(nodeId);
    for (const row of outgoing) {
      const tid = row.to_id;
      if (visited.has(tid)) {
        children.push({ id: tid, children: [] });
      } else {
        visited.add(tid);
        children.push(build(tid, depth + 1));
      }
    }
    return { id: nodeId, children };
  }

  visited.add(startId);
  return build(startId, 0);
}

/**
 * Find all distinct simple paths from start -> target up to depthLimit.
 * Returns array of paths (each is array of node ids), uses DFS with cycle prevention.
 */
export function allPathsBetween(db: IDatabase, startId: string, targetId: string, depthLimit = 20) {
  const { immediateCallees } = createTraversalHelpers(db);
  const paths: string[][] = [];
  const visited = new Set<string>();

  function dfs(curr: string, path: string[]) {
    if (path.length > depthLimit) return;
    if (curr === targetId) {
      paths.push([...path]);
      return;
    }
    const outgoing = immediateCallees(curr);
    for (const row of outgoing) {
      const nid = row.to_id;
      if (path.includes(nid)) continue; // prevent cycles in path
      path.push(nid);
      dfs(nid, path);
      path.pop();
    }
  }

  dfs(startId, [startId]);
  return paths;
}

/**
 * Compute hotspots: returns arrays of top N nodes by incoming edge count (fan-in)
 * and by outgoing edge count (fan-out).
 */
export function computeHotspots(db: IDatabase, top = 20) {
  const incoming = db.prepare(`
    SELECT to_id as node, COUNT(*) as cnt
    FROM edges
    GROUP BY to_id
    ORDER BY cnt DESC
    LIMIT ?
  `).all(top);

  const outgoing = db.prepare(`
    SELECT from_id as node, COUNT(*) as cnt
    FROM edges
    GROUP BY from_id
    ORDER BY cnt DESC
    LIMIT ?
  `).all(top);

  return { incoming, outgoing };
}