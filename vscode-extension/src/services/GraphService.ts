/**
 * GraphService manages the lifecycle of the GraphAPI instance, 
 * which provides access to the project's graph database.
 * It handles loading different projects, closing connections, 
 * and exposing the API to other parts of the extension.
 */
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import type { GraphAPI, IDatabase } from '@backlens/graph-store'; // Import types only for now
import { ProjectRegistry, type RegisteredProject } from '../core/ProjectRegistry';

/**
 * Dynamically loads the GraphAPI and its database connection.
 */
async function loadGraphAPI(dbPath: string): Promise<{ api: GraphAPI; db: IDatabase }> {
  // Dynamic import to avoid bundling issues
  // Importing '@backlens/graph-store' might trigger the loading of better-sqlite3 (native module).
  // If we import it at the top level, VS Code might crash immediately upon startup.
  const { createGraphAPIFromDb, createWasmSqliteAdapter } = await import('@backlens/graph-store');

  const wasmPath = path.join(__dirname, 'sql-wasm.wasm');
  let wasmBinary: ArrayBuffer | undefined;

  if (fs.existsSync(wasmPath)) {
    const wasmBuffer = fs.readFileSync(wasmPath);
    wasmBinary = wasmBuffer.buffer.slice(wasmBuffer.byteOffset, wasmBuffer.byteOffset + wasmBuffer.byteLength);
  }

  const db = await createWasmSqliteAdapter(dbPath, { wasmBinary, wasmPath });
  const api = createGraphAPIFromDb(db);

  return { api, db };
}

/**
 * Manages the GraphAPI lifecycle and provides query access.
 * This class is a "Service Singleton" that holds the CURRENTLY OPEN project.
 */
export class GraphService implements vscode.Disposable {
  private api: GraphAPI | null = null;
  private db: IDatabase | null = null;
  private currentProject: RegisteredProject | null = null;
  private readonly registry: ProjectRegistry;

  // Allows other parts of the UI (like the Sidebar or Status Bar) to react when 
  // the user switches projects.
  private _onDidChangeProject = new vscode.EventEmitter<RegisteredProject | null>();
  readonly onDidChangeProject = this._onDidChangeProject.event;

  // Dependency Injection: We need the registry to update "Last Used" dates.
  // We inject it via the constructor, which makes testing easier and 
  // decouples the GraphService from directly importing the registry.
  constructor(projectRegistry: ProjectRegistry) {
    this.registry = projectRegistry;
  }

  /**
   * Load a project's database using WASM-based SQLite.
   */
  async loadProject(project: RegisteredProject): Promise<void> {
    this.close();

    try {
      const { api, db } = await loadGraphAPI(project.dbPath);
      this.api = api;
      this.db = db;
      this.currentProject = project;
      this.registry.setActiveProject(project.rootPath);
      this._onDidChangeProject.fire(project);
    } catch (err: any) {
      const message = err?.message ?? String(err);
      vscode.window.showErrorMessage(`Failed to load project: ${message}`);
      throw err;
    }
  }

  /**
   * Get the current GraphAPI instance for querying
   */
  getAPI(): GraphAPI | null {
    return this.api;
  }

  /**
   * Get the currently loaded project.
   */
  getCurrentProject(): RegisteredProject | null {
    return this.currentProject;
  }

  /**
   * Close the current database connection.
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.api = null;
      this.currentProject = null;
      this.registry.setActiveProject(null);
      this._onDidChangeProject.fire(null);
    }
  }

  // Called by VS Code when the extension is deactivated (user closes the window).
  dispose(): void {
    this.close();
    this._onDidChangeProject.dispose();
  }
}