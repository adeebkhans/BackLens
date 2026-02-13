import * as vscode from 'vscode';
import { ProjectRegistry } from '../core/ProjectRegistry';
import { ProjectDetector } from '../core/ProjectDetector';
import { AnalysisWorker } from '../core/AnalysisWorker';
import { GraphService } from '../services/GraphService';

/**
 * Analyzes a selected folder: detects if it's a project, runs analysis, registers it
 */
export async function analyzeFolder(
  uri: vscode.Uri | undefined, // The folder user right-clicked (can be undefined if run via Command Palette)
  registry: ProjectRegistry,  // Dependency Injection: The storage service
  graphService: GraphService  // Dependency Injection: The database service
): Promise<void> {
  let folderPath = uri?.fsPath;

  // If User ran command via Ctrl+Shift+P (Command Palette) instead of right-click.
  // In this case, 'uri' is undefined, so we must guess the folder.
  if (!folderPath) {
    // Get all folders currently open in the VS Code workspace.
    const folders = vscode.workspace.workspaceFolders;

    // Safety Check: If no folder is open, we can't analyze anything.
    if (!folders || folders.length === 0) {
      vscode.window.showErrorMessage('No workspace folder selected');
      return;
    }
    // Default to the first open folder.
    folderPath = folders[0].uri.fsPath;
  }

  try {
    // UI FEEDBACK (Show progress while analyzing)
    // 'withProgress' creates a notification in the bottom-right corner.
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Analyzing project...'
      },
      async (progress) => {
        // Tell user what's happening. 'increment: 0' initializes the bar.
        progress.report({ increment: 0, message: 'Detecting project root...' });

        // Find project root
        const detectedRoot = ProjectDetector.findNearestRoot(folderPath!);
        if (!detectedRoot) {
          vscode.window.showErrorMessage('No valid project root found (looking for package.json, etc.)');
          return;
        }

        const projectRoot = detectedRoot.path; // e.g., "c:\projects\my-app"
        const projectName = detectedRoot.name; // e.g., "my-app"

        progress.report({ increment: 20, message: 'Running analysis...' });

        // Generate database path in VS Code's global storage area
        const dbPath = registry.generateDbPath(projectRoot);

        // Run analysis in worker
        const worker = new AnalysisWorker();
        // We pass 'progress' down so the worker can update the bar (e.g. "Parsed 50/100 files").
        const result = await worker.analyze(projectRoot, dbPath, progress);

        if (!result.success) {
          vscode.window.showErrorMessage(`Analysis failed: ${result.error}`);
          return;
        }

        progress.report({ increment: 70, message: 'Registering project...' });

        // Register in registry (Save metadata to 'projectRegistry')
        // Next time user opens VS Code, we'll remember this project exists.
        registry.registerProject({
          name: projectName,
          rootPath: projectRoot,
          dbPath: result.dbPath!,
          lastAnalyzed: Date.now()
        });

        progress.report({ increment: 10, message: 'Loading into graph service...' });

        // Load into GraphService
        await graphService.loadProject({
          name: projectName,
          rootPath: projectRoot,
          dbPath: result.dbPath!,
          lastAnalyzed: Date.now(),
          lastUsed: Date.now()
        });

        progress.report({ increment: 100 });

        // Show message and WAIT for user to click
        const selection = await vscode.window.showInformationMessage(
          `✓ Project "${projectName}" analyzed successfully`,
          'View Graph'
        );

        // If they clicked the button, run the command
        if (selection === 'View Graph') {
          vscode.commands.executeCommand('backlens.showGraph');
        }
      }
    );
  } catch (error: any) {
    vscode.window.showErrorMessage(`Error analyzing folder: ${error.message}`);
  }
}