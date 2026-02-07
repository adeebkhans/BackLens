/**
 * Abstract interface for graph data access.
 * Implementations:
 *   - HttpGraphProvider: Uses axios for standalone web (graphApi)
 *   - VsCodeGraphProvider: Uses postMessage for extension webview
 */
import type {
  GraphNode,
  HotspotNode,
  CallersCalleesResponse,
  TransitiveNode,
  PathResult,
  QueryOptions,
  SemanticStats
} from '../types/graph';

export interface IGraphProvider {

  // --- Node Operations ---

  /**
   * Search for nodes by query string
   */
  searchNodes(query: string, limit?: number): Promise<GraphNode[]>;

  /**
   * Get a single node by ID
   */
  getNode(id: string): Promise<GraphNode | null>;

  // --- Call Graph Operations ---

  /**
   * Get direct callers of a node
   */
  getCallers(id: string, options?: QueryOptions): Promise<CallersCalleesResponse>;

  /**
   * Get direct callees of a node
   */
  getCallees(id: string, options?: QueryOptions): Promise<CallersCalleesResponse>;

  /**
   * Get transitive callers (multi-hop)
   */
  getTransitiveCallers(
    id: string,
    options?: QueryOptions & { tree?: boolean }
  ): Promise<GraphNode[] | TransitiveNode>;

  /**
   * Get transitive callees (multi-hop)
   */
  getTransitiveCallees(
    id: string,
    options?: QueryOptions & { tree?: boolean }
  ): Promise<GraphNode[] | TransitiveNode>;

  // --- Analysis Operations ---

  /**
   * Get hotspots (most connected nodes)
   */
  getHotspots(top?: number, options?: QueryOptions): Promise<HotspotNode[]>;

  /**
   * Find shortest path between two nodes
   */
  getShortestPath(
    start: string,
    target: string,
    options?: QueryOptions
  ): Promise<PathResult | null>;

  /**
   * Find all paths between two nodes
   */
  getAllPaths(
    start: string,
    target: string,
    options?: QueryOptions & { depthLimit?: number; maxPaths?: number }
  ): Promise<PathResult[]>;

  // --- Semantic Hierarchy Operations ---

  /**
   * Get functions in a file
   */
  getFunctionsInFile(fileId: string, options?: QueryOptions): Promise<CallersCalleesResponse>;

  /**
   * Get all classes in the graph
   */
  getClasses(options?: QueryOptions): Promise<GraphNode[]>;

  /**
   * Get methods of a specific class
   */
  getMethodsOfClass(classId: string, options?: QueryOptions): Promise<CallersCalleesResponse>;

  /**
   * Get classes in a specific file
   */
  getClassesInFile(fileId: string, options?: QueryOptions): Promise<CallersCalleesResponse>;

  /**
   * Get semantic statistics for the graph
   */
  getSemanticStats?(): Promise<SemanticStats>;
}