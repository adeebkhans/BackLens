/**
 * This file defines the ProjectTreeProvider. It defines the howe "BackLens" tab 
 * in the VS Code sidebar will look. It is responsible for displaying the project structure in a tree view
 */
import * as vscode from 'vscode';
import { ProjectRegistry, type RegisteredProject } from '../core/ProjectRegistry';
import { ProjectDetector, type DetectedRoot } from '../core/ProjectDetector';

// Defines the 4 different "kinds" of rows that can appear in the list.
type TreeItemType =
  | 'active-header'    // The group title: "Active Context"
  | 'active-project'   // The actual open project (e.g., "my-app")
  | 'available-header' // The group title: "Available Workspaces"
  | 'detected-root';   // Other projects found on disk but not currently analyzed.

/**
 * THE TREE ITEM (The Row Class)
 * Every single line in the sidebar is an instance of this class.
 */
class ProjectTreeItem extends vscode.TreeItem {
  constructor(
    public readonly itemType: TreeItemType,
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState, // expanded, collapsed or a leaf node
    public readonly data?: RegisteredProject | DetectedRoot
  ) {
    // Call the parent VS Code class to set the text label
    super(label, collapsibleState);

    // Customize the look based on what type of item this is (header, project, or detected root)
    this.setupItem();
  }

  private setupItem(): void {
    switch (this.itemType) {
      // CASE A: The "Active Context" Header
      case 'active-header':
        // Icon: A solid green circle.
        this.iconPath = new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('charts.green'));
        // ContextValue: Used in package.json "menus" to show specific right-click actions for this row.
        this.contextValue = 'activeHeader';
        break;

      // CASE B: The currently open project 
      case 'active-project':
        // Icon: An open folder
        this.iconPath = new vscode.ThemeIcon('folder-opened');
        this.contextValue = 'activeProject';
        this.description = (this.data as RegisteredProject)?.rootPath; // Description: Gray text next to the label

        // CLICK ACTION:
        // When user clicks this row, run the 'backlens.showGraph' command.
        this.command = {
          command: 'backlens.showGraph',
          title: 'Open Graph',
          arguments: [this.data]
        };
        break;

      // CASE C: The "Available Workspaces" Header
      case 'available-header':
        // Icon: A library folder
        this.iconPath = new vscode.ThemeIcon('folder-library');
        this.contextValue = 'availableHeader';
        break;

      // CASE D: Detected Roots (other projects found on disk, not active)
      case 'detected-root': {
        const root = this.data as DetectedRoot;
        // Icon: A regular folder
        this.iconPath = new vscode.ThemeIcon('folder');
        this.contextValue = 'detectedRoot';
        this.description = `${root.type} • ${root.marker}`; // Description: "node • package.json"
        this.tooltip = root.path; // Tooltip: Hover text showing full path
        break;
      }
    }
  }
}

/**
 * THE TREE PROVIDER (The Data Source)
 * This class provides the data for the Tree View in the sidebar.
 * VS Code calls this class to populate the view.
 * It tells VS Code how many items there are, what their labels are, and their hierarchy.
 */
export class ProjectTreeProvider implements vscode.TreeDataProvider<ProjectTreeItem>, vscode.Disposable {
  
  // This tells VS Code that the data changed! Please re-render the list
  private _onDidChangeTreeData = new vscode.EventEmitter<ProjectTreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private detectedRoots: DetectedRoot[] = [];

  // We need the registry to know which project is active, 
  // and to react when user switches projects.
  constructor(private registry: ProjectRegistry) {
    registry.onDidChange(() => this.refresh());
    this.detectWorkspaceRoots();
  }

  // Force a refresh 
  refresh(): void {
    this.detectWorkspaceRoots();
    this._onDidChangeTreeData.fire(undefined);
  }

  /**
   * Detect projects in the user's workspace folders. 
   * This runs on startup and whenever the registry changes.
   */
  private detectWorkspaceRoots(): void {
    this.detectedRoots = [];
    const folders = vscode.workspace.workspaceFolders;
    if (folders) {
      for (const folder of folders) {
        const roots = ProjectDetector.detectRoots(folder.uri.fsPath);
        this.detectedRoots.push(...roots);
      }
    }
  }

  // VS Code calls this to get the UI representation of a data element.
  // Since our data elements ARE already UI items (ProjectTreeItem), we just return them.
  getTreeItem(element: ProjectTreeItem): vscode.TreeItem {
    return element;
  }

  // VS Code calls this to get the children of a given element in the tree.
  // If no element is provided, it means "give me the top-level items".
  getChildren(element?: ProjectTreeItem): ProjectTreeItem[] {
    if (!element) {
      const items: ProjectTreeItem[] = [];
      const active = this.registry.getActiveProject();

      // If a project is currently active, show the "Active Context" group.
      if (active) {
        items.push(new ProjectTreeItem('active-header', 'Active Context', vscode.TreeItemCollapsibleState.Expanded));
      }
      // Always show "Available Workspaces" group.
      items.push(new ProjectTreeItem('available-header', 'Available Workspaces', vscode.TreeItemCollapsibleState.Expanded));
      return items;
    }

    // If the element is a header, show the appropriate children 
    switch (element.itemType) {

      // What goes inside "Active Context"
      case 'active-header': {
        const active = this.registry.getActiveProject();
        if (active) {
          // Return the single active project row.
          return [new ProjectTreeItem('active-project', active.name, vscode.TreeItemCollapsibleState.None, active)];
        }
        return [];
      }

      // What goes inside "Available Workspaces"
      case 'available-header': {
        const activeRoot = this.registry.getActiveProject()?.rootPath;
        // Filter: Don't show the project here if it's already shown in the "Active" section above
        const available = this.detectedRoots.filter(r => r.path !== activeRoot);
        return available.map(root =>
          new ProjectTreeItem('detected-root', root.name, vscode.TreeItemCollapsibleState.None, root)
        );
      }

      default:
        return [];
    }
  }

  dispose(): void {
    this._onDidChangeTreeData.dispose();
  }
}