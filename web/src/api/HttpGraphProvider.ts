/**
 * HTTP-based provider for standalone web deployment.
 * Simply delegates to the existing graphApi axios client.
 */
import type { IGraphProvider } from './IGraphProvider';
import type {
  GraphNode,
  HotspotNode,
  CallersCalleesResponse,
  TransitiveNode,
  PathResult,
  QueryOptions,
  SemanticStats
} from '../types/graph';
import { graphApi } from './graphApi';

export class HttpGraphProvider implements IGraphProvider {

  // --- Node Operations ---

  async searchNodes(query: string, limit = 100): Promise<GraphNode[]> {
    return graphApi.searchNodes(query, limit);
  }

  async getNode(id: string): Promise<GraphNode | null> {
    return graphApi.getNode(id);
  }

  // --- Call Graph Operations ---

  async getCallers(id: string, options?: QueryOptions): Promise<CallersCalleesResponse> {
    return graphApi.getCallers(id, options);
  }

  async getCallees(id: string, options?: QueryOptions): Promise<CallersCalleesResponse> {
    return graphApi.getCallees(id, options);
  }

  async getTransitiveCallers(
    id: string,
    options?: QueryOptions & { tree?: boolean }
  ): Promise<GraphNode[] | TransitiveNode> {
    return graphApi.getTransitiveCallers(id, options);
  }

  async getTransitiveCallees(
    id: string,
    options?: QueryOptions & { tree?: boolean }
  ): Promise<GraphNode[] | TransitiveNode> {
    return graphApi.getTransitiveCallees(id, options);
  }

  // --- Analysis Operations ---

  async getHotspots(top = 20, options?: QueryOptions): Promise<HotspotNode[]> {
    return graphApi.getHotspots(top, options);
  }

  async getShortestPath(
    start: string,
    target: string,
    options?: QueryOptions
  ): Promise<PathResult | null> {
    return graphApi.getShortestPath(start, target, options);
  }

  async getAllPaths(
    start: string,
    target: string,
    options?: QueryOptions & { depthLimit?: number; maxPaths?: number }
  ): Promise<PathResult[]> {
    return graphApi.getAllPaths(start, target, options);
  }

  // --- Semantic Hierarchy Operations ---

  async getFunctionsInFile(fileId: string, options?: QueryOptions): Promise<CallersCalleesResponse> {
    return graphApi.getFunctionsInFile(fileId, options);
  }

  async getClasses(options?: QueryOptions): Promise<GraphNode[]> {
    return graphApi.getClasses(options);
  }

  async getMethodsOfClass(classId: string, options?: QueryOptions): Promise<CallersCalleesResponse> {
    return graphApi.getMethodsOfClass(classId, options);
  }

  async getClassesInFile(fileId: string, options?: QueryOptions): Promise<CallersCalleesResponse> {
    return graphApi.getClassesInFile(fileId, options);
  }

  async getSemanticStats(): Promise<SemanticStats> {
    return graphApi.getSemanticStats();
  }
}
