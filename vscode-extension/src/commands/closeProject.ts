import * as vscode from 'vscode';
import { ProjectRegistry } from '../core/ProjectRegistry';
import { GraphService } from '../services/GraphService';
import { ProjectTreeProvider } from '../providers/ProjectTreeProvider';

/**
 * Closes the currently active project
 */
export async function closeProject(
  registry: ProjectRegistry,
  graphService: GraphService,
  treeProvider: ProjectTreeProvider
): Promise<void> {
  const currentProject = registry.getActiveProject();
  if (!currentProject) {
    vscode.window.showWarningMessage('No active project to close');
    return;
  }

  // Clean up
  graphService.close();
  registry.setActiveProject(null);
  treeProvider.refresh();

  vscode.window.showInformationMessage(`Project "${currentProject.name}" closed`);
}