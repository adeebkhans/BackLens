import { PersistNode } from "../persistence/NodeStore";
import { QueryOptions } from "./QueryOptions";

// ---Secondary Filtering---

/**
 * Applies type filters (include/exclude) and semantic filters to a single node.
 */
export function filterNode(
  node: PersistNode | null,
  opts?: QueryOptions
): PersistNode | null {
  if (!node) return null;

  // 1. Exclude Check: If excludeTypes is set and node type is in the list, exclude it.
  if (opts?.excludeTypes && opts.excludeTypes.includes(node.type)) {
    return null;
  }

  // 2. Include Check: If includeTypes is set and node type is NOT in the list, exclude it.
  if (opts?.includeTypes && !opts.includeTypes.includes(node.type)) {
    return null;
  }

  // 3. Hide External: Exclude external nodes and placeholder nodes with external meta
  if (opts?.hideExternal) {
    if (node.type === 'external') return null;
    if (node.type === 'placeholder' && node.meta?.external) return null;
  }

  // 4. Hide Framework: Exclude nodes with isFramework metadata
  if (opts?.hideFramework) {
    if (node.meta?.isFramework) return null;
  }

  return node;
}

/**
 * Applies type filters to an array of nodes.
 */
export function filterNodes(
  nodes: (PersistNode | null)[],
  opts?: QueryOptions
): PersistNode[] {
  // Map calls filterNode and then filters out all resulting nulls
  return nodes
    .map(n => filterNode(n, opts))
    .filter(Boolean) as PersistNode[];
}

/**
 * Build a SQL WHERE clause fragment for edge type filtering.
 * Returns the clause and whether it was applied.
 */
export function buildEdgeTypeClause(edgeTypes?: string[]): string {
  if (!edgeTypes || edgeTypes.length === 0) {
    // Default: include both call and method_call
    return `(type = 'call' OR type = 'method_call')`;
  }
  const conditions = edgeTypes.map(t => `type = '${t}'`).join(' OR ');
  return `(${conditions})`;
}