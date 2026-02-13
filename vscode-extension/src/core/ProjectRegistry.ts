/**
 * ProjectRegistry.ts - Manages persistent storage of analyzed projects.
 * Its job is to remember every project the user has ever analyzed
 */
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

// Saved Project info in registry
export interface RegisteredProject {
  name: string;
  rootPath: string;
  dbPath: string;
  lastAnalyzed: number;
  lastUsed: number;
}

// Registry.json structure
export interface RegistryData {
  version: number;
  projects: Record<string, RegisteredProject>; // "Path" -> "Project Details"
  activeProjectPath: string | null; // Project that was open last time
}

/**
 * Manages persistent storage of analyzed projects.
 * Uses VS Code's globalStorageUri for cross-session persistence.
 */
export class ProjectRegistry {
  // SINGLETON PATTERN SETUP
  // static instance stores the ONE and ONLY copy of this class.
  private static instance: ProjectRegistry;
  private data: RegistryData; // in-memory copy of our JSON file
  private registryPath: string; // Where the JSON file lives on disk

  // EventEmitter: This is a Notification System.
  // Other parts of the app can "subscribe" to this. When the registry changes
  // (e.g., a new project is added), we fire this event so the UI updates automatically.
  private _onDidChange = new vscode.EventEmitter<void>(); // emitter
  readonly onDidChange = this._onDidChange.event; // listener that other parts of the app can subscribe to

  // private constructor because This is only called once, in getInstance(). 
  // It initializes the registryPath and loads existing data from disk.
  // Private so we cannot do 'new ProjectRegistry()' because we want SINGLETON pattern.
  private constructor(private context: vscode.ExtensionContext) {
    this.registryPath = path.join(context.globalStorageUri.fsPath, 'registry.json');
    this.data = this.load();// Load existing data from disk immediately on startup.
  }

  // This ensures the entire extension shares the exact same list of projects.
  static getInstance(context?: vscode.ExtensionContext): ProjectRegistry {
    // On First time Create the instance, also we must pass the context because 
    // it needs it to know where to store the registry.json file.
    if (!ProjectRegistry.instance) {
      if (!context) {
        throw new Error('ProjectRegistry requires context on first init');
      }
      ProjectRegistry.instance = new ProjectRegistry(context);
    }
    return ProjectRegistry.instance;
  }

  // --- PERSISTENCE METHODS (Load & Save) ---

  // Reads 'registry.json' from disk into memory.
  private load(): RegistryData {
    try {
      if (fs.existsSync(this.registryPath)) {
        const raw = fs.readFileSync(this.registryPath, 'utf8');
        return JSON.parse(raw) as RegistryData;
      }
    } catch (error) {
      console.error('Failed to load registry:', error);
    }
    return { version: 1, projects: {}, activeProjectPath: null };
  }

  // Writes memory back to 'registry.json'.
  private save(): void {
    const dir = path.dirname(this.registryPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.registryPath, JSON.stringify(this.data, null, 2));
    this._onDidChange.fire(); // NOTIFY LISTENERS that the list of projects just changed!
  }

  // --- PUBLIC ACCESSORS ---

  // Get a project by its root path
  getProject(rootPath: string): RegisteredProject | undefined {
    return this.data.projects[rootPath];
  }

  // Get all registered projects as an array (for the "Recent Projects" sidebar).
  getAllProjects(): RegisteredProject[] {
    return Object.values(this.data.projects);
  }

  // Get the currently active project (the one that was open last time user used the extension)
  getActiveProject(): RegisteredProject | null {
    if (!this.data.activeProjectPath) {
      return null;
    }
    return this.data.projects[this.data.activeProjectPath] || null;
  }

  // --- STATE MODIFIERS ---

  // Set the active project by its root path
  setActiveProject(rootPath: string | null): void {
    if (rootPath && this.data.projects[rootPath]) {
      this.data.projects[rootPath].lastUsed = Date.now();
    }
    this.data.activeProjectPath = rootPath;
    this.save();
  }

  // Register a new project or update an existing one (called after AnalysisWorker finishes).
  registerProject(project: Omit<RegisteredProject, 'lastUsed'>): void {
    this.data.projects[project.rootPath] = {
      ...project,
      lastUsed: Date.now()
    };
    this.save();
  }

  // Delete a project
  removeProject(rootPath: string): void {
    const project = this.data.projects[rootPath];
    if (project) {
      if (fs.existsSync(project.dbPath)) {
        try {
          fs.unlinkSync(project.dbPath);
        } catch (error) {
          console.warn('Failed to delete DB file:', error);
        }
      }
      delete this.data.projects[rootPath];
      if (this.data.activeProjectPath === rootPath) {
        this.data.activeProjectPath = null;
      }
      this.save();
    }
  }

  /**
   * Check if a path (or any parent) is already registered.
   * Use Case: User opens a file "src/utils/helper.ts". We need to know if 
   * "src" or root is already a known project so we can auto-load the graph.
   */
  findProjectForPath(filePath: string): RegisteredProject | null {
    const normalized = path.normalize(filePath);
    for (const project of Object.values(this.data.projects)) {
      const projNorm = path.normalize(project.rootPath);
      // Check: Is the file INSIDE this project folder?
      // Logic: Does "C:/Projects/MyApp/src/file.ts" start with "C:/Projects/MyApp"?
      if (normalized === projNorm || normalized.startsWith(projNorm + path.sep)) {
        return project;
      }
    }
    return null;
  }

  /**
    * Generate a unique database path for a project.
    * We use a HASH of the path to create a filename.
    * Example: "C:/Projects/MyApp" -> "hash123.db"
    * Why? Because paths contain slashes "/" which are illegal in filenames.
    */
  generateDbPath(rootPath: string): string {
    const hash = this.hashPath(rootPath);
    // Result: ".../globalStorage/databases/1a2b3c.db"
    return path.join(this.context.globalStorageUri.fsPath, 'databases', `${hash}.db`);
  }

  // Dan Bernstein's algorithm
  private hashPath(p: string): string {
    let hash = 0;
    for (let i = 0; i < p.length; i++) {
      hash = ((hash << 5) - hash) + p.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16);
  }
}