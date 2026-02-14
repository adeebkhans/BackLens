import * as vscode from 'vscode';
import { ProjectRegistry } from './core/ProjectRegistry';
import { GraphService } from './services/GraphService';
import { ProjectTreeProvider } from './providers/ProjectTreeProvider';
import { GraphWebviewProvider } from './providers/GraphWebviewProvider';
import { NavigationService } from './services/NavigationService';
import { analyzeFolder } from './commands/analyzeFolder';
import { refreshExplorer } from './commands/refreshExplorer';
import { closeProject } from './commands/closeProject';
import { goToNode } from './commands/goToNode';

let projectRegistry: ProjectRegistry;
let graphService: GraphService;
let graphWebviewProvider: GraphWebviewProvider;
let navigationService: NavigationService;
let projectTreeProvider: ProjectTreeProvider;

/**
 * Activates the BackLens extension.
 * This function is called ONCE when VS Code detects that the user wants to use our extension.
 * Initializes all services, providers, and command handlers.
 */
export async function activate(context: vscode.ExtensionContext) {
  console.log('BackLens extension activating...');

  try {
    // --- Initialize core services ---

    // Step A: Load the Registry. This reads 'registry.json' from disk.
    // We pass 'context' so it knows where globalStorage is.
    projectRegistry = ProjectRegistry.getInstance(context);
    // Step B: Create the GraphService. It needs the registry to update "Last Used" times.
    graphService = new GraphService(projectRegistry);
    // Step C: Create NavigationService. It needs GraphService to look up file paths for nodes.
    navigationService = new NavigationService(graphService);
    // Step D: Create the Webview Provider. It needs context (for HTML paths) and GraphService (for data).
    graphWebviewProvider = new GraphWebviewProvider(context, graphService);
    // Step E: Create the Sidebar Provider. It needs the registry to list saved projects.
    projectTreeProvider = new ProjectTreeProvider(projectRegistry);

    // UI REGISTRATION (The Sidebar)- Register project explorer tree view provider
    vscode.window.registerTreeDataProvider('backlens.projectExplorer', projectTreeProvider);
    context.subscriptions.push(projectTreeProvider); // Add to subscriptions: If the extension is disabled, VS Code will auto-dispose the provider.

    // --- COMMAND REGISTRATION (The Buttons) ---

    // Register command: analyzeFolder
    context.subscriptions.push(
      vscode.commands.registerCommand('backlens.analyzeFolder', async (uri?: vscode.Uri) => {
        await analyzeFolder(uri, projectRegistry, graphService);
        projectTreeProvider.refresh();
      })
    );

    // Register command: showGraph
    context.subscriptions.push(
      vscode.commands.registerCommand('backlens.showGraph', async () => {
        const currentProject = projectRegistry.getActiveProject();
        if (!currentProject) {
          vscode.window.showWarningMessage('No project loaded. Please analyze a project first.');
          return;
        }
        graphWebviewProvider.show();
      })
    );

    // Register command: refreshExplorer
    context.subscriptions.push(
      vscode.commands.registerCommand('backlens.refreshExplorer', async () => {
        await refreshExplorer(projectTreeProvider);
      })
    );

    // Register command: closeProject
    context.subscriptions.push(
      vscode.commands.registerCommand('backlens.closeProject', async () => {
        await closeProject(projectRegistry, graphService, projectTreeProvider);
      })
    );

    // Register command: goToNode
    context.subscriptions.push(
      vscode.commands.registerCommand('backlens.goToNode', async (nodeId: string) => {
        await goToNode(navigationService, nodeId);
      })
    );

    // Auto-load existing project if available
    const activeProject = projectRegistry.getActiveProject();
    if (activeProject) {
      graphService.loadProject(activeProject)
        .then(() => console.log(`BackLens: Loaded project "${activeProject.name}"`))
        .catch((error: any) => console.error(`BackLens: Failed to auto-load project: ${error.message}`));
    }

    console.log('BackLens extension activated successfully');
  } catch (error: any) {
    console.error('BackLens activation error:', error);
    vscode.window.showErrorMessage(`BackLens initialization failed: ${error.message}`);
  }
}

/**
 * Deactivates the BackLens extension.
 * Cleans up resources.
 */
export function deactivate() {
  console.log('BackLens extension deactivating...');
  graphService?.close();
  graphWebviewProvider?.dispose();
}