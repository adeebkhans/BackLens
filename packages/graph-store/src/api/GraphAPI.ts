import { QueryOptions } from "./QueryOptions";

// Defines the structure of a generic graph node as stored in the database.
export type GraphNode = {
    id: string;
    type: string; // The category of the node (e.g., "function", "file", "external")
    label?: string | null; // Human-readable name
    meta?: any | null; // JSON blob for detailed metadata (line numbers, etc.)
};

// Defines the structure of a graph edge.
export type GraphEdge = {
    from: string; // Source node ID
    to: string; // Target node ID
    type: string; // The relationship type (e.g., "call", "contains")
    meta?: any | null;
};

/**
 * Defines the structured node format returned to consumers, extracting key metadata
 * from the raw 'meta' JSON blob for easier consumption.
 */
export type ExpandedNode = {
    id: string;
    type: string;
    label?: string | null;
    file?: string | null; // File path extracted from meta
    name?: string | null; // Function/class name extracted from meta
    start?: { line: number; column: number } | null; // Starting location
    end?: { line: number; column: number } | null; // Ending location
    meta?: any | null; // Full raw metadata object
};

/**
 * Result structure for flat list queries (e.g., transitive callers).
 */
export type FlatListResult = {
    raw: string[]; // Array of filtered node IDs
    expanded?: ExpandedNode[]; // Optional array of expanded node objects
};

/**
 * Defines a node within a tree structure (used for transitive tree results).
 */
export type TreeNode = {
    nodeId: string;
    node?: ExpandedNode | null;
    children: TreeNode[];
};

/**
 * Result structure for tree queries.
 */
export type TreeResult = {
    root: TreeNode;
};

/**
 * Result structure for call chain queries
 */
export type ChainResult = {
    rawPath: string[]; // Ordered array of node IDs forming the path
    expandedPath?: ExpandedNode[]; // Optional ordered array of expanded nodes
};

/**
 * Result structure for Hotspot analysis (fan-in/fan-out).
 */
export type HotspotEntry = {
    nodeId: string;
    node?: ExpandedNode | null;
    in?: number; // Number of incoming call edges (fan-in)
    out?: number; // Number of outgoing call edges (fan-out)
    score?: number; // Simple complexity score (e.g., in * out)
};

/**
 * Public API Contract: Unified interface for core and advanced graph queries.
 * All query methods accept QueryOptions for filtering and expansion control.
 * Enhanced with Object-Aware Semantic Analysis support.
 */
export type GraphAPI = {
    // Metadata & Search
    getNode(nodeId: string): GraphNode | null; // Retrieves a single raw node
    searchNodes(query: string): GraphNode[]; // Fuzzy search across node IDs and labels
    getAllNodes(): GraphNode[]; // Get all nodes in the graph
    getAllEdges(): GraphEdge[]; // Get all edges in the graph

    // Direct Neighbors
    getCallers(nodeId: string, options?: QueryOptions): FlatListResult; // Direct incoming call edges
    getCallees(nodeId: string, options?: QueryOptions): FlatListResult; // Direct outgoing call edges

    // Containment (Hierarchy)
    getFunctionsInFile(nodeId: string, options?: QueryOptions): FlatListResult; // Finds functions contained in a file node

    // Transitive (Full Traversal)
    transitiveCallersFlat(nodeId: string, options?: QueryOptions): FlatListResult; // All reachable upstream callers (flat list)
    transitiveCallersTree(nodeId: string, options?: QueryOptions): TreeResult; // All reachable upstream callers (tree structure)

    transitiveCalleesFlat(nodeId: string, options?: QueryOptions): FlatListResult; // All reachable downstream callees (flat list)
    transitiveCalleesTree(nodeId: string, options?: QueryOptions): TreeResult; // All reachable downstream callees (tree structure)

    // Pathfinding
    allCallChains(
        startId: string,
        targetId: string,
        options?: QueryOptions & { depthLimit?: number; maxPaths?: number } // Options allow depth and path count limits
    ): ChainResult[];

    // Analysis
    hotspots(options?: QueryOptions & { top?: number }): HotspotEntry[]; // Returns highest scoring nodes by fan-in/fan-out
    getSemanticStats?(): SemanticStats; // Optional semantic analysis statistics

    // Lifecycle
    close(): void; // Closes the underlying database connection
};

/**
 * Semantic analysis statistics for the graph.
 */
export type SemanticStats = {
    totalNodes: number;
    totalEdges: number;
    classes: number;
    methods: number;
    functions: number;
    files: number;
    methodCalls: number;
    functionCalls: number;
    frameworkCalls: number;
};