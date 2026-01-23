import { PersistNode } from "../persistence/NodeStore";
import { QueryOptions } from "./QueryOptions";

// ---Secondary Filtering---

/**
 * Applies type filters (include/exclude) to a single node.
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