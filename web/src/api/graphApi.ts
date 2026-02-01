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
      { params: options }
    );
    return data.data;
  },

  /**
   * Get direct callees of a node
   */
  async getCallees(id: string, options?: QueryOptions): Promise<CallersCalleesResponse> {
    const { data } = await api.get<ApiResponse<CallersCalleesResponse>>(
      `/calls/${encodeURIComponent(id)}/callees`,
      { params: options }
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
      { params: options }
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
      { params: options }
    );
    return data.data;
  },

  /**
   * Get hotspots (most connected nodes)
   */
  async getHotspots(top = 20, options?: QueryOptions): Promise<HotspotNode[]> {
    const { data } = await api.get<ApiResponse<HotspotNode[]>>('/analytics/hotspots', {
      params: { top, ...options }
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
    const { data } = await api.get<ApiResponse<PathResult>>('/traversal/path/shortest', {
      params: { start, target, ...options }
    });
    return data.success ? data.data : null;
  },

  /**
   * Find all paths between two nodes
   */
  async getAllPaths(
    start: string,
    target: string,
    options?: QueryOptions & { depthLimit?: number; maxPaths?: number }
  ): Promise<PathResult[]> {
    const { data } = await api.get<ApiResponse<PathResult[]>>('/traversal/path/all', {
      params: { start, target, ...options }
    });
    return data.data;
  },

  /**
   * Get functions in a file
   */
  async getFunctionsInFile(fileId: string, options?: QueryOptions): Promise<CallersCalleesResponse> {
    const { data } = await api.get<ApiResponse<CallersCalleesResponse>>(
      `/calls/${encodeURIComponent(fileId)}/functions`,
      { params: options }
    );
    return data.data;
  },

  // --- Object-Aware Semantic Analysis APIs ---

  /**
   * Get all classes in the graph
   */
  async getClasses(options?: QueryOptions): Promise<GraphNode[]> {
    const { data } = await api.get<ApiResponse<GraphNode[]>>('/nodes', {
      params: { ...options, includeTypes: 'class' }
    });
    return data.data;
  },

  /**
   * Get methods of a specific class
   */
  async getMethodsOfClass(classId: string, options?: QueryOptions): Promise<CallersCalleesResponse> {
    const { data } = await api.get<ApiResponse<CallersCalleesResponse>>(
      `/calls/${encodeURIComponent(classId)}/methods`,
      { params: options }
    );
    return data.data;
  },

  /**
   * Get classes in a specific file
   */
  async getClassesInFile(fileId: string, options?: QueryOptions): Promise<CallersCalleesResponse> {
    const { data } = await api.get<ApiResponse<CallersCalleesResponse>>(
      `/calls/${encodeURIComponent(fileId)}/classes`,
      { params: options }
    );
    return data.data;
  },

  /**
   * Get method callers (who calls this method)
   * Optionally filter to only show method_call edges
   */
  async getMethodCallers(methodId: string, options?: QueryOptions & { onlyMethodCalls?: boolean }): Promise<CallersCalleesResponse> {
    const { data } = await api.get<ApiResponse<CallersCalleesResponse>>(
      `/calls/${encodeURIComponent(methodId)}/callers`,
      { params: { ...options, edgeType: options?.onlyMethodCalls ? 'method_call' : undefined } }
    );
    return data.data;
  },

  /**
   * Get method callees (what does this method call)
   * Optionally filter by edge type
   */
  async getMethodCallees(methodId: string, options?: QueryOptions & { onlyMethodCalls?: boolean; hideFramework?: boolean }): Promise<CallersCalleesResponse> {
    const { data } = await api.get<ApiResponse<CallersCalleesResponse>>(
      `/calls/${encodeURIComponent(methodId)}/callees`,
      { params: { ...options, edgeType: options?.onlyMethodCalls ? 'method_call' : undefined, hideFramework: options?.hideFramework } }
    );
    return data.data;
  },

  /**
   * Get class hierarchy (classes with their methods) for a file
   */
  async getFileClassHierarchy(fileId: string): Promise<{ classes: Array<{ class: GraphNode; methods: GraphNode[] }>; functions: GraphNode[] }> {
    const { data } = await api.get<ApiResponse<{ classes: Array<{ class: GraphNode; methods: GraphNode[] }>; functions: GraphNode[] }>>(
      `/semantic/${encodeURIComponent(fileId)}/hierarchy`
    );
    return data.data;
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
