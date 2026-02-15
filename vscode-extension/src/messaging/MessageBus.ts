/**
 * This file acts as the Operator. 
 * It sits between the Webview (UI) and the GraphService (Database).
 * When the webview sends a message like "getNode" or "searchNodes",
 * the MessageBus receives it, calls the appropriate method on GraphService's API,
 * and then sends the result back to the webview.
 */
import * as vscode from 'vscode';
import { GraphService } from '../services/GraphService';
import type { GraphAPI } from '@backlens/graph-store';

// Define the shape of messages coming FROM the webview (requests)
export interface WebviewMessage {
  type: 'request';
  requestId: string;
  command: string; // The name of the function to run  ex- "getNode" etc.
  params: Record<string, unknown>; // The parameters for that function
}


// Define the shape of messages going TO the webview (responses)
export interface ResponseMessage {
  type: 'response';
  requestId: string;
  data?: unknown;
  error?: string;
}

// Define the shape of command messages (direct command execution)
export interface CommandMessage {
  type: 'command';
  command: string; // VS Code command ID (e.g., "backlens.goToNode")
  args: any[]; // Command arguments
}

/**
 * Handles bidirectional communication between webview and extension.
 * It translates "JSON Messages" into "Function Calls".
 */
export class MessageBus implements vscode.Disposable {
  private disposable: vscode.Disposable;

  constructor(
    private webview: vscode.Webview, // The UI connection
    private graphService: GraphService // The Database connection
  ) {
    // Start listening immediately
    // When the Webview sends a message, run 'this.handleMessage'
    this.disposable = webview.onDidReceiveMessage(
      (message: WebviewMessage) => this.handleMessage(message)
    );
  }

  /**
   * When the webview sends a message, this function is called.
   * Checks the command, calls the right GraphService method, and sends back the result.
   */
  private handleMessage(message: WebviewMessage | CommandMessage): void {
    // Handle direct command messages (one-way)
    if ((message as CommandMessage).type === 'command') {
      const cmdMsg = message as CommandMessage;
      vscode.commands.executeCommand(cmdMsg.command, ...(cmdMsg.args || []));
      return;
    }

    // Handle RPC requests (expecting a response)
    if ((message as WebviewMessage).type !== 'request') {
      return;
    }

    const { requestId, command, params } = message as WebviewMessage;

    try {
      const data = this.executeCommand(command, params);
      this.sendResponse({ type: 'response', requestId, data });
    } catch (error: any) {
      this.sendResponse({ type: 'response', requestId, error: error.message });
    }
  }

  private executeCommand(command: string, params: Record<string, unknown>): unknown {
    const apiOrNull = this.graphService.getAPI();
    if (!apiOrNull) {
      throw new Error('No project loaded. Please analyze a project first.');
    }

    const api: GraphAPI = apiOrNull;

    switch (command) {
      case 'searchNodes': {
        const result = api.searchNodes(params.query as string, params.options as any);
        return result;
      }

      case 'getNode': {
        const result = api.getNode(params.id as string);
        return result;
      }

      case 'getCallers': {
        const result = api.getCallers(params.id as string, params.options as any);
        return result;
      }

      case 'getCallees': {
        const result = api.getCallees(params.id as string, params.options as any);
        return result;
      }

      case 'getTransitiveCallers': {
        const options = params.options as any;
        const result = options?.tree
          ? api.transitiveCallersTree(params.id as string, options)
          : api.transitiveCallersFlat(params.id as string, options);
        return result;
      }

      case 'getTransitiveCallees': {
        const options = params.options as any;
        const result = options?.tree
          ? api.transitiveCalleesTree(params.id as string, options)
          : api.transitiveCalleesFlat(params.id as string, options);
        return result;
      }

      case 'getHotspots': {
        const result = api.hotspots(params.options as any);
        return result;
      }

      case 'getAllPaths': {
        const result = api.allCallChains(
          params.start as string,
          params.target as string,
          params.options as any
        );
        return result;
      }

      case 'getFunctionsInFile': {
        const result = api.getFunctionsInFile(params.fileId as string, params.options as any);
        return result;
      }

      case 'getClasses': {
        const options = params.options as any;
        const result = api.getAllNodes({ ...options, includeTypes: ['class'] });
        return result;
      }

      case 'getMethodsOfClass': {
        const options = params.options as any;
        const result = api.getFunctionsInFile(params.classId as string, { ...options, includeTypes: ['method'] });
        return result;
      }

      case 'getClassesInFile': {
        const options = params.options as any;
        const result = api.getFunctionsInFile(params.fileId as string, { ...options, includeTypes: ['class'] });
        return result;
      }

      case 'getSemanticStats': {
        const result = api.getSemanticStats?.();
        return result;
      }

      default:
        throw new Error(`Unknown command: ${command}`);
    }
  }

  private sendResponse(message: ResponseMessage): void {
    this.webview.postMessage(message);
  }

  dispose(): void {
    this.disposable.dispose();
  }
}