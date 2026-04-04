/**
 * HTTP client for BackLens core-api
 */
import axios from 'axios';
import type {
  ApiResponse,
  GraphNode,
  HotspotNode,
  CallersCalleesResponse,
  TransitiveNode,
  PathResult,
  QueryOptions
} from '../types/graph';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';
const API_TIMEOUT = parseInt(import.meta.env.VITE_API_TIMEOUT || '10000');

const api = axios.create({
  baseURL: API_BASE,
  timeout: API_TIMEOUT,
});

/**
 * Serialize QueryOptions for HTTP params.
 * Arrays are comma-separated, booleans are passed as-is.
 */
function serializeOptions(options?: QueryOptions): Record<string, any> | undefined {
  if (!options) return undefined;
  const params: Record<string, any> = {};
  if (options.expanded !== undefined) params.expanded = options.expanded;
  if (options.includeTypes?.length) params.includeTypes = options.includeTypes.join(',');
  if (options.excludeTypes?.length) params.excludeTypes = options.excludeTypes.join(',');
  if (options.maxDepth !== undefined) params.maxDepth = options.maxDepth;
  if (options.tree !== undefined) params.tree = options.tree;
  if (options.hideExternal !== undefined) params.hideExternal = options.hideExternal;
  if (options.hideFramework !== undefined) params.hideFramework = options.hideFramework;
  if (options.edgeTypes?.length) params.edgeTypes = options.edgeTypes.join(',');
  return params;
}

export const graphApi = {
  /**
   * Search for nodes by query string
   */
  async searchNodes(query: string, limit = 100): Promise<GraphNode[]> {
    const { data } = await api.get<ApiResponse<GraphNode[]>>('/nodes', {
      params: { q: query, limit }
    });
    return data.data;
  },

  /**
   * Get a single node by ID
   */
  async getNode(id: string): Promise<GraphNode | null> {
    try {
      const { data } = await api.get<ApiResponse<GraphNode>>(`/nodes/${encodeURIComponent(id)}`);
      return data.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Get direct callers of a node
   */
  async getCallers(id: string, options?: QueryOptions): Promise<CallersCalleesResponse> {
    const { data } = await api.get<ApiResponse<CallersCalleesResponse>>(
      `/calls/${encodeURIComponent(id)}/callers`,
      { params: serializeOptions(options) }
    );
    return data.data;
  },

  /**
   * Get direct callees of a node
   */
  async getCallees(id: string, options?: QueryOptions): Promise<CallersCalleesResponse> {
    const { data } = await api.get<ApiResponse<CallersCalleesResponse>>(
      `/calls/${encodeURIComponent(id)}/callees`,
      { params: serializeOptions(options) }
    );
    return data.data;
  },

  /**
   * Get transitive callers (multi-hop)
   */
  async getTransitiveCallers(
    id: string,
    options?: QueryOptions & { tree?: boolean }
  ): Promise<GraphNode[] | TransitiveNode> {
    const { data } = await api.get<ApiResponse<GraphNode[] | TransitiveNode>>(
      `/traversal/${encodeURIComponent(id)}/callers/transitive`,
      { params: serializeOptions(options) }
    );
    return data.data;
  },

  /**
   * Get transitive callees (multi-hop)
   */
  async getTransitiveCallees(
    id: string,
    options?: QueryOptions & { tree?: boolean }
  ): Promise<GraphNode[] | TransitiveNode> {
    const { data } = await api.get<ApiResponse<GraphNode[] | TransitiveNode>>(
      `/traversal/${encodeURIComponent(id)}/callees/transitive`,
      { params: serializeOptions(options) }
    );
    return data.data;
  },

  /**
   * Get hotspots (most connected nodes)
   */
  async getHotspots(top = 20, options?: QueryOptions): Promise<HotspotNode[]> {
    const { data } = await api.get<ApiResponse<HotspotNode[]>>('/analytics/hotspots', {
      params: { top, ...serializeOptions(options) }
    });
    return data.data;
  },

  /**
   * Find shortest path between two nodes
   */
  async getShortestPath(
    start: string,
    target: string,
    options?: QueryOptions
  ): Promise<PathResult | null> {
    const { data } = await api.get<ApiResponse<PathResult | null>>('/traversal/path/shortest', {
      params: { start, target, ...serializeOptions(options) }
    });
    return data.data ?? null;
  },

  /**
   * Find all paths between two nodes
   */
  async getAllPaths(
    start: string,
    target: string,
    options?: QueryOptions & { depthLimit?: number; maxPaths?: number }
  ): Promise<PathResult[]> {
    const { depthLimit, maxPaths, ...rest } = options || {};
    const { data } = await api.get<ApiResponse<PathResult[]>>('/traversal/path/all', {
      params: { start, target, depthLimit, maxPaths, ...serializeOptions(rest) }
    });
    return data.data;
  },

  /**
   * Get functions in a file
   */
  async getFunctionsInFile(fileId: string, options?: QueryOptions): Promise<CallersCalleesResponse> {
    const { data } = await api.get<ApiResponse<CallersCalleesResponse>>(
      `/calls/${encodeURIComponent(fileId)}/functions`,
      { params: serializeOptions(options) }
    );
    return data.data;
  },

  // --- Object-Aware Semantic Analysis APIs ---

  /**
   * Get all classes in the graph
   */
  async getClasses(options?: QueryOptions): Promise<GraphNode[]> {
    const { data } = await api.get<ApiResponse<GraphNode[]>>('/nodes', {
      params: { ...serializeOptions(options), includeTypes: 'class' }
    });
    return data.data;
  },

  /**
   * Get methods of a specific class
   */
  async getMethodsOfClass(classId: string, options?: QueryOptions): Promise<CallersCalleesResponse> {
    const { data } = await api.get<ApiResponse<CallersCalleesResponse>>(
      `/calls/${encodeURIComponent(classId)}/methods`,
      { params: serializeOptions(options) }
    );
    return data.data;
  },

  /**
   * Get classes in a specific file
   */
  async getClassesInFile(fileId: string, options?: QueryOptions): Promise<CallersCalleesResponse> {
    const { data } = await api.get<ApiResponse<CallersCalleesResponse>>(
      `/calls/${encodeURIComponent(fileId)}/classes`,
      { params: serializeOptions(options) }
    );
    return data.data;
  },

  /**
   * Get method callers (who calls this method)
   * Optionally filter to only show method_call edges
   */
  async getMethodCallers(methodId: string, options?: QueryOptions & { onlyMethodCalls?: boolean }): Promise<CallersCalleesResponse> {
    const edgeTypes = options?.onlyMethodCalls ? ['method_call'] : options?.edgeTypes;
    const { data } = await api.get<ApiResponse<CallersCalleesResponse>>(
      `/calls/${encodeURIComponent(methodId)}/callers`,
      {
        params: serializeOptions({
          ...options,
          edgeTypes
        })
      }
    );
    return data.data;
  },

  /**
   * Get method callees (what does this method call)
   * Optionally filter by edge type
   */
  async getMethodCallees(methodId: string, options?: QueryOptions & { onlyMethodCalls?: boolean; hideFramework?: boolean }): Promise<CallersCalleesResponse> {
    const edgeTypes = options?.onlyMethodCalls ? ['method_call'] : options?.edgeTypes;
    const { data } = await api.get<ApiResponse<CallersCalleesResponse>>(
      `/calls/${encodeURIComponent(methodId)}/callees`,
      {
        params: serializeOptions({
          ...options,
          edgeTypes,
          hideFramework: options?.hideFramework
        })
      }
    );
    return data.data;
  },

  /**
   * Get class hierarchy (classes with their methods) for a file
   */
  async getFileClassHierarchy(fileId: string): Promise<{ classes: Array<{ class: GraphNode; methods: GraphNode[] }>; functions: GraphNode[] }> {
    const [classesResult, functionsResult] = await Promise.all([
      this.getClassesInFile(fileId, { expanded: true }),
      this.getFunctionsInFile(fileId, { expanded: true, includeTypes: ['function'] })
    ]);

    const classes = await Promise.all(
      classesResult.expanded.map(async (classNode) => {
        const methodsResult = await this.getMethodsOfClass(classNode.id, { expanded: true });
        return {
          class: classNode,
          methods: methodsResult.expanded
        };
      })
    );

    return {
      classes,
      functions: functionsResult.expanded
    };
  },

  /**
   * Get semantic statistics for the graph
   */
  async getSemanticStats(): Promise<{
    totalNodes: number;
    totalEdges: number;
    classes: number;
    methods: number;
    functions: number;
    files: number;
    methodCalls: number;
    functionCalls: number;
    frameworkCalls: number;
  }> {
    const { data } = await api.get<ApiResponse<any>>('/analytics/semantic-stats');
    return data.data;
  },

  /**
   * Health check
   */
  async health(): Promise<{ status: string; uptime: number }> {
    const { data } = await api.get('/health');
    return data;
  }
};
