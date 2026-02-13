import * as vscode from 'vscode';
import { ProjectTreeProvider } from '../providers/ProjectTreeProvider';

/**
 * Refreshes the project explorer tree view
 */
export async function refreshExplorer(treeProvider: ProjectTreeProvider): Promise<void> {
  treeProvider.refresh();
}
