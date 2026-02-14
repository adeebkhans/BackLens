/**
 * GraphWebviewProvider is responsible for creating and managing 
 * the Webview panel (tab inside VS Code where our React app lives).
 */
import * as vscode from 'vscode';
import * as fs from 'fs';
import { GraphService } from '../services/GraphService';
import { MessageBus } from '../messaging/MessageBus';

export class GraphWebviewProvider {
  public static readonly viewType = 'backlens.graphView'; // A unique ID for this view. Used by VS Code to track which tab is which.
  private panel: vscode.WebviewPanel | null = null; // The actual panel instance (the tab we see). Null if closed.
  private messageBus: MessageBus | null = null; // The listener that handles "postMessage" events.

  private context: vscode.ExtensionContext;
  private graphService: GraphService;

  // Constructor receives dependencies (Context for paths, Service for data)
  constructor(
    context: vscode.ExtensionContext,
    graphService: GraphService
  ) {
    this.context = context;
    this.graphService = graphService;
  }

  /**
   * Show or reveal the graph panel.
   * This is called when the user runs the "BackLens: Show Graph" command.
   */
  show(focusNodeId?: string): void {
    // if panel already exists, just reveal it
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
      // If the user wants to jump to a specific node, send a message immediately.
      if (focusNodeId) {
        this.panel.webview.postMessage({ type: 'focusNode', nodeId: focusNodeId });
      }
      return;
    }

    // Otherwise, create a new one.
    this.panel = vscode.window.createWebviewPanel(
      GraphWebviewProvider.viewType, // ID
      'BackLens Graph',             // Title (shown on the tab)
      vscode.ViewColumn.One,       // Column One = The main editor area
      {
        enableScripts: true, // Allow JavaScript (React) to run.
        retainContextWhenHidden: true, // Don't kill the React app when user switches tabs.
        localResourceRoots: [
          vscode.Uri.joinPath(this.context.extensionUri, 'webview')
        ]
      }
    );

    // Read 'index.html' from disk, fix paths, inject security tags, and set it as content.
    this.panel.webview.html = this.getHtmlContent(this.panel.webview);

    // SETUP COMMUNICATION
    // Create the bridge. The MessageBus will now start listening for "getNodes", etc.
    this.messageBus = new MessageBus(this.panel.webview, this.graphService);
    // Add to subscriptions so it gets cleaned up if the extension is deactivated.
    this.context.subscriptions.push(this.messageBus);

    // Handle closing the panel
    this.panel.onDidDispose(() => {
      this.panel = null;
      this.messageBus?.dispose();
      this.messageBus = null;
    }, null, this.context.subscriptions);

    if (focusNodeId) {
      setTimeout(() => {
        this.panel?.webview.postMessage({ type: 'focusNode', nodeId: focusNodeId });
      }, 500);
    }
  }

  /** 
   * Transforms standard HTML into a VS Code-compatible webview by injecting 
   * security policies (CSP) and re-mapping asset paths to extension-specific URIs.
   */
  private getHtmlContent(webview: vscode.Webview): string {
    // Calculate paths on disk 
    const webviewPath = vscode.Uri.joinPath(this.context.extensionUri, 'webview');
    const htmlPath = vscode.Uri.joinPath(webviewPath, 'index.html');
    // Convert disk path to a special "vscode-resource:" URI.
    // VS Code won't load "C:/Users/..." directly. It needs "vscode-resource:/..."
    const rootUri = webview.asWebviewUri(webviewPath);

    let html = fs.readFileSync(htmlPath.fsPath, 'utf8'); // Read the file content

    // Add CSP and Base Tag
    const csp = [
      `default-src 'none'`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src ${webview.cspSource}`,
      `img-src ${webview.cspSource} data:`,
      `font-src ${webview.cspSource}`
    ].join('; ');

    // Inject Base Tag to handle relative paths (like ./assets/icon.png) correctly
    html = html.replace(
      '<head>',
      `<head>
       <base href="${rootUri}/">
       <meta http-equiv="Content-Security-Policy" content="${csp}">`
    );

    // Path fix
    // Vite (the build tool) sometimes outputs absolute paths like src="/assets/index.js".
    // In VS Code's webview, "/" means the root of the file system (C:\), which is blocked.
    // We rewrite "/assets/" to "assets/" so it respects the <base> tag we just added.
    html = html.replace(/(src|href)="\/assets\//g, '$1="assets/');

    return html;
  }

  dispose(): void {
    this.panel?.dispose();
  }
}