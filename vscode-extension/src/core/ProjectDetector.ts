import * as fs from 'fs';
import * as path from 'path';

/**
 * Defines the structure of a detected project root
 */
export interface DetectedRoot {
  path: string;
  name: string;
  type: 'node' | 'python' | 'go' | 'rust' | 'unknown';
  marker: string;
}

const MARKERS: Record<string, 'node' | 'python' | 'go' | 'rust'> = {
  'package.json': 'node',
  'requirements.txt': 'python',
  'pyproject.toml': 'python',
  'go.mod': 'go',
  'Cargo.toml': 'rust'
};

const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '__pycache__',
  '.venv',
  'target'
]);

/**
 * Scans workspace folders to detect project roots.
 */
export class ProjectDetector {
  /**
   * Find all project roots within a directory (non-recursive for top-level,
   * then one level deep for monorepo detection).
   */
  static detectRoots(workspacePath: string, maxDepth = 2): DetectedRoot[] {
    const roots: DetectedRoot[] = [];
    // Start the recursive scan. Results are pushed into the 'roots' array
    this.scanDir(workspacePath, roots, 0, maxDepth);
    return roots;
  }

  private static scanDir(dir: string, results: DetectedRoot[], depth: number, maxDepth: number): void {
    if (depth > maxDepth) {
      return;
    }

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      // Check for marker files at this level
      for (const entry of entries) {
        if (entry.isFile() && MARKERS[entry.name]) {
          results.push({
            path: dir,
            name: path.basename(dir),
            type: MARKERS[entry.name],
            marker: entry.name
          });
          return;
        }
      }

      // Recurse into subdirectories
      for (const entry of entries) {
        if (entry.isDirectory() && !IGNORE_DIRS.has(entry.name)) {
          this.scanDir(path.join(dir, entry.name), results, depth + 1, maxDepth);
        }
      }
    } catch {
      // Ignore permission errors
    }
  }

  /**
   * Walk up from a path to find the nearest project root.
   * 
   * Logic: If user clicked 'src/components', we want the parent 'my-app' (where package.json is)
   * If we analyze just 'components', imports like "src/utils" will break
   */
  static findNearestRoot(startPath: string): DetectedRoot | null {
    let current = path.normalize(startPath);
    const root = path.parse(current).root; // Get the hard drive root

    // Keep going up until we hit the top of the drive
    while (current !== root) {
      for (const marker of Object.keys(MARKERS)) {
        if (fs.existsSync(path.join(current, marker))) {
          return {
            path: current,
            name: path.basename(current),
            type: MARKERS[marker],
            marker
          };
        }
      }
      current = path.dirname(current);
    }
    return null;
  }
}