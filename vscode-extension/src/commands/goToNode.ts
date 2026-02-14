import * as vscode from 'vscode';
import { NavigationService } from '../services/NavigationService';

/**
 * Navigate to source code location of a node in the graph
 */
export async function goToNode(
  navigationService: NavigationService,
  nodeId: string
): Promise<void> {
  try {
    await navigationService.goToNode(nodeId);
  } catch (error: any) {
    vscode.window.showErrorMessage(`Could not navigate to node: ${error.message}`);
  }
}