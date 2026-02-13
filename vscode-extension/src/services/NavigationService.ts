/**
 * NavigationService.ts is the Bridge between the Graph Visualization and the Code Editor.
 * When a user clicks a node in the graph (e.g., "Function: loginUser"), 
 * this service is responsible for opening the correct file (auth.ts), 
 * scrolling to line 45, and highlighting the function definition.
 */
import * as vscode from 'vscode';
import * as path from 'path';
import { GraphService } from './GraphService';

/**
 * Handles navigation from graph nodes to source code.
 */
export class NavigationService {

  // Dependency Injection: We need GraphService to look up node metadata (file path, line number).
  constructor(private graphService: GraphService) { }

  /**
   * Navigate to a node's source location.
   */
  async goToNode(nodeId: string): Promise<void> {
    const api = this.graphService.getAPI();
    const project = this.graphService.getCurrentProject();
    if (!api || !project) {
      vscode.window.showWarningMessage('No project loaded');
      return;
    }

    const node = api.getNode(nodeId);
    if (!node?.meta) {
      vscode.window.showWarningMessage('Node has no source location');
      return;
    }

    const meta: any = node.meta;
    const file = meta.file || meta.path;

    if (!file) {
      vscode.window.showWarningMessage('Node has no file information');
      return;
    }

    // The parser stored a relative path ("src/index.ts"), we must join it with the 
    // project root ("C:/Projects/MyApp") to get the full OS path ("C:/Projects/MyApp/src/index.ts").
    // If it's already absolute (rare), use it as is.
    const absolutePath = path.isAbsolute(file) ? file : path.join(project.rootPath, file);

    // Extract line and column information from various possible metadata structures
    let line: number | undefined;
    let column: number = 0;

    if (meta.start && typeof meta.start === 'object') {
      // Case 1: Regular nodes (functions, methods, classes) with meta.start object
      line = meta.start.line;
      column = meta.start.column || 0;
    } else if (typeof meta.line === 'number') {
      // Case 2: Placeholder nodes (method calls) with meta.line number
      line = meta.line;
      column = 0;
    } else if (typeof meta.startLine === 'number') {
      // Case 3: Alternative format with meta.startLine
      line = meta.startLine;
      column = meta.startColumn || 0;
    }

    if (line === undefined) {
      vscode.window.showWarningMessage('Node has no line information');
      return;
    }

    try {
      // Convert string path to VS Code URI (handles file:// protocol).
      const uri = vscode.Uri.file(absolutePath);
      // Load the document into memory.
      const doc = await vscode.workspace.openTextDocument(uri);
      // Display the document in the editor.
      const editor = await vscode.window.showTextDocument(doc, {
        viewColumn: vscode.ViewColumn.One, 
        preserveFocus: false // Move keyboard focus to the code so user can type
      });

      // Navigate to the extracted position (line is 1-indexed in parser, 0-indexed in VS Code)
      const position = new vscode.Position(line - 1, column);
      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(
        new vscode.Range(position, position),
        vscode.TextEditorRevealType.InCenter
      );
    } catch (err: any) {
      vscode.window.showErrorMessage(`Failed to open file: ${err.message}`);
    }
  }
}