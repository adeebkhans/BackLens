/**
 * Interface for consistent filtering and limiting across all graph queries.
 */
export interface QueryOptions {
  includeTypes?: string[];   // Only allow these node types (e.g., ["function"])
  excludeTypes?: string[];   // Exclude these node types (e.g., ["file", "placeholder"])
  maxDepth?: number;         // Traversal depth limit (used by transitive queries)
  expanded?: boolean;        // Return raw IDs vs. expanded node details (default: true)
}