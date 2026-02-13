/**
 * VS Code webview provider using postMessage for communication.
 * All requests are sent to the extension host and responses are awaited via promises.
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

// Type definitions for the VS Code webview API
type VsCodeApi = {
  postMessage(message: unknown): void; // Send message to extension host
  getState(): unknown; // Get persisted state (if any)
  setState(state: unknown): void;
};

// TypeScript plumbing to let compiler know that acquireVsCodeApi() exists and will be injected by VS Code.
declare global {
  interface Window {
    acquireVsCodeApi?: () => VsCodeApi;
  }
}

// Internal types for managing pending requests and responses
interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
}

// Response message format from extension host
interface ResponseMessage {
  type: 'response';
  requestId: string;
  data?: unknown;
  error?: string;
}

/**
 * VS Code webview provider using postMessage for communication.
 * All requests are sent to the extension host and responses are awaited via promises.
 * it turns a fire-and-forget 'postMessage' into an await-able function call.
 */
export class VsCodeGraphProvider implements IGraphProvider {
  private vscode: VsCodeApi;
  // Map of pending requests waiting for responses from the extension host. (requestId -> {resolve, reject})
  private pendingRequests = new Map<string, PendingRequest>();
  private requestId = 0;

  constructor() {
    // Acquire the VS Code API (only available inside webview)
    if (!window.acquireVsCodeApi) {
      throw new Error('VsCodeGraphProvider can only be used inside a VS Code webview');
    }
    this.vscode = window.acquireVsCodeApi();

    // Listen for responses from extension host
    window.addEventListener('message', (event: MessageEvent<ResponseMessage>) => {
      const message = event.data;
      if (message.type === 'response' && message.requestId) {
        const pending = this.pendingRequests.get(message.requestId);
        if (pending) {
          this.pendingRequests.delete(message.requestId);
          if (message.error) {
            pending.reject(new Error(message.error));
          } else {
            pending.resolve(message.data);
          }
        }
      }
    });
  }

  // Wraps cross-window messaging in a Promise to allow 'awaiting' responses from the VS Code extension host
  private async request<T>(command: string, params: Record<string, unknown> = {}): Promise<T> {
    const id = `req_${++this.requestId}`;
    // Manually creates a Promise. This "pauses" the function here. 
    // It will only finish when either resolve/reject is called later (in event listener).
    return new Promise<T>((resolve, reject) => {
      this.pendingRequests.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject
      });
      this.vscode.postMessage({ type: 'request', requestId: id, command, params });
    });
  }

  // --- Node Operations ---

  async searchNodes(query: string, limit = 100): Promise<GraphNode[]> {
    return this.request('searchNodes', { query, limit });
  }

  async getNode(id: string): Promise<GraphNode | null> {
    return this.request('getNode', { id });
  }

  // --- Call Graph Operations ---

  async getCallers(id: string, options?: QueryOptions): Promise<CallersCalleesResponse> {
    return this.request('getCallers', { id, options });
  }

  async getCallees(id: string, options?: QueryOptions): Promise<CallersCalleesResponse> {
    return this.request('getCallees', { id, options });
  }

  async getTransitiveCallers(
    id: string,
    options?: QueryOptions & { tree?: boolean }
  ): Promise<GraphNode[] | TransitiveNode> {
    return this.request('getTransitiveCallers', { id, options });
  }

  async getTransitiveCallees(
    id: string,
    options?: QueryOptions & { tree?: boolean }
  ): Promise<GraphNode[] | TransitiveNode> {
    return this.request('getTransitiveCallees', { id, options });
  }

  // --- Analysis Operations ---

  async getHotspots(top = 20, options?: QueryOptions): Promise<HotspotNode[]> {
    return this.request('getHotspots', { top, options });
  }

  async getShortestPath(
    start: string,
    target: string,
    options?: QueryOptions
  ): Promise<PathResult | null> {
    return this.request('getShortestPath', { start, target, options });
  }

  async getAllPaths(
    start: string,
    target: string,
    options?: QueryOptions & { depthLimit?: number; maxPaths?: number }
  ): Promise<PathResult[]> {
    return this.request('getAllPaths', { start, target, options });
  }

  // --- Semantic Hierarchy Operations ---

  async getFunctionsInFile(fileId: string, options?: QueryOptions): Promise<CallersCalleesResponse> {
    return this.request('getFunctionsInFile', { fileId, options });
  }

  async getClasses(options?: QueryOptions): Promise<GraphNode[]> {
    return this.request('getClasses', { options });
  }

  async getMethodsOfClass(classId: string, options?: QueryOptions): Promise<CallersCalleesResponse> {
    return this.request('getMethodsOfClass', { classId, options });
  }

  async getClassesInFile(fileId: string, options?: QueryOptions): Promise<CallersCalleesResponse> {
    return this.request('getClassesInFile', { fileId, options });
  }

  async getSemanticStats(): Promise<SemanticStats> {
    return this.request('getSemanticStats', {});
  }
}

// Note: The httpGraphProvider uses graphApi.ts (of web) which is a thin wrapper around fetch/axios 
// to call the extension host's REST API endpoints.
// In contrast, VsCodeGraphProvider uses the GraphApi instance created from core api (defined in vscode-extension\src\services\GraphService.ts)
// and exposes it to the webview which then uses the 
// 'postMessage' mechanism to send requests to the extension host and receive responses.