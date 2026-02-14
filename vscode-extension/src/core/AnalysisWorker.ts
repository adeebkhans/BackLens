/**
 * Process Manager - Runs the analysis in a separate process to avoid blocking the extension host.
 * It communicates with the main process via messages to report progress and results.
 */
import * as vscode from 'vscode';
import { fork, ChildProcess } from 'child_process';
import * as path from 'path';

// Results returned from the worker process after analysis is complete
export interface AnalysisResult {
  success: boolean;
  dbPath?: string;
  error?: string;
  stats?: {
    files: number;
    functions: number;
    classes: number;
    methods: number;
    edges: number;
  };
}

/**
 * Runs the parser in a child process to avoid blocking the extension host.
 */
export class AnalysisWorker {
  private process: ChildProcess | null = null; // reference to the running process
  private cancellationToken: vscode.CancellationTokenSource | null = null; // A token used to cancel the operation if the user clicks "Cancel".

  /**
   * Analyze a project root and generate a SQLite database.
   */
  async analyze(
    rootPath: string,
    dbPath: string,
    progress: vscode.Progress<{ message?: string; increment?: number }>
  ): Promise<AnalysisResult> {
    this.cancellationToken = new vscode.CancellationTokenSource();

    return new Promise((resolve) => {
      progress.report({ message: 'Starting analysis...' });

      // Determine the path to the worker script and the extension root.
      const workerScript = path.join(__dirname, 'workers', 'analyzeWorker.js');
      const extensionPath = path.join(__dirname, '..');

      console.log('[AnalysisWorker] workerScript:', workerScript);
      console.log('[AnalysisWorker] extensionPath:', extensionPath);
      console.log('[AnalysisWorker] __dirname:', __dirname);

      // Sanitize environment - remove Electron/VS Code specific variables
      // VS Code runs inside "Electron". Electron adds a ton of special environment variables
      // to control how processes behave
      // If we spawn a standard Node.js process but inherit these variables, the child process
      // might try to act like a VS Code window or crash because it expects Electron features
      // that aren't there.
      const env = { ...process.env }; // copy the current environment variables and delete rest
      delete env.ELECTRON_RUN_AS_NODE;
      delete env.VSCODE_IPC_HOOK;
      delete env.VSCODE_HANDLES;
      delete env.VSCODE_PID;
      delete env.VSCODE_NLS_CONFIG;
      delete env.VSCODE_CODE_CACHE_PATH;
      delete env.VSCODE_CWD;
      delete env.VSCODE_CRASH_REPORTER_START_OPTIONS;
      delete env.NODE_OPTIONS;

      // --- SPAWNING THE PROCESS ---

      this.process = fork(workerScript, [], {
        cwd: extensionPath,
        // stdio configuration:
        // 'pipe' x3: Create channels for Stdin, Stdout, Stderr so we can see logs.
        // 'ipc': "Inter-Process Communication". Vital. Allows process.send() and process.on('message').
        stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
        
        // process.execPath tells which executable started the current process.
        // We don't want to spawn another Electron window. We want 'node'.
        // Below Avoids spawning heavy Electron/VS Code windows for background tasks 
        // by forcing the use of the lightweight 'node' binary (assumes node is in user's system PATH)
        execPath: process.execPath.includes('electron') || process.execPath.includes('Code')
          ? 'node'
          : process.execPath,
        execArgv: [], // Clear flags like '--debug-brk' so the worker doesn't pause waiting for a debugger.
        env: env
      });

      // Capture stdout output (console logs) from worker
      if (this.process.stdout) {
        this.process.stdout.on('data', (data) => {
          console.log('[Worker stdout]:', data.toString());
        });
      }

      // Capture stderr output from worker
      if (this.process.stderr) {
        this.process.stderr.on('data', (data) => {
          console.error('[Worker stderr]:', data.toString());
        });
      }

      // --- STARTING THE JOB ---

      // send start message to worker with parameters
      this.process.send({ type: 'start', rootPath, dbPath });

      // listen to results from worker
      this.process.on('message', (msg: any) => {
        if (msg.type === 'progress') {
          progress.report({ message: msg.message, increment: msg.increment });
        } else if (msg.type === 'complete') {
          resolve({ success: true, dbPath, stats: msg.stats });
        } else if (msg.type === 'error') {
          resolve({ success: false, error: msg.error });
        }
      });

      this.process.on('error', (err) => {
        resolve({ success: false, error: err.message });
      });

      this.process.on('exit', (code) => {
        if (code !== 0 && code !== null) {
          resolve({ success: false, error: `Worker exited with code ${code}` });
        }
      });
    });
  }

  /**
   * Emergency Stop Button.
   * Called if the user cancels the operation or closes VS Code.
   */
  cancel(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.cancellationToken?.cancel();
  }
}