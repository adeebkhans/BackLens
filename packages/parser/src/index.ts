import fs from "fs";
import path from "path";
import { parse } from "@babel/parser";
// Import the @babel/traverse module as a namespace object
import * as traverseModule from "@babel/traverse";
// VITAL FIX: Robustly define the 'traverse' function to handle ESM/CJS module conflicts.
// It checks if the function is nested under .default or if the whole module object is the function.
const traverse: typeof traverseModule.default = (traverseModule as any).default ?? (traverseModule as any);
import type { NodePath } from "@babel/traverse"; // type definition for NodePath, used during AST traversal
import * as t from "@babel/types"; //  type definitions for AST nodes (e.g., t.isFunctionDeclaration)
import { fileURLToPath } from "node:url";
import { resolve } from "node:path"; 

// --- Type Definitions for the Intermediate Representation (IR) ---

// Defines the structure for a Function Node (a function definition)
type FunctionNode = {
  id: string; // stable ID: file:start:line:end:col
  name: string | null;
  file: string;
  start: { line: number; column: number };
  end: { line: number; column: number };
};

// Defines the structure for a Call Edge (a function call)
type CallEdge = {
  from: string; // The ID of the calling function or route
  to: string; // The temporary ID of the called function (callee)
  calleeName?: string | null; // The textual name of the callee (for later resolution)
};

// Defines the overall structure of the parsing output
type ParseResult = {
  functions: FunctionNode[];
  calls: CallEdge[];
  files: string[];
};

// --- Helper: Directory Traversal ---

// Recursively walks a directory and returns a list of file paths matching extensions
function walkDir(dir: string, exts = [".ts", ".js", ".tsx", ".jsx"]): string[] {
  const out: string[] = [];
  // NEW: Immediately exit if the directory does not exist, preventing ENOENT errors
  if (!fs.existsSync(dir)) return out;
  // Reads directory entries, including file type info
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  // Loop through each entry
  for (const e of entries) {
    const p = path.join(dir, e.name);
    // If directory, recurse
    if (e.isDirectory()) {
      out.push(...walkDir(p, exts));
    }
    // If file and supported extension, add to output
    else if (exts.includes(path.extname(e.name))) {
      out.push(p);
    }
  }
  return out;
}

// --- Helper: Stable ID Generation ---

// Creates a stable, unique ID for an AST node using its file path and location
function idForNode(file: string, node: t.Node): string {
  // 'loc' (location) property holds line and column info
  const loc = node.loc;
  // Handle case where location might be missing
  if (!loc) return `${file}:unknown`;
  // Format the ID: file:startLine:startCol-endLine:endCol
  return `${file}:${loc.start.line}:${loc.start.column}-${loc.end.line}:${loc.end.column}`;
}

// --- Core: File Parsing Logic ---

// Parses a single file and extracts its functions and calls
function parseFile(filePath: string): ParseResult {
  // Read the file content
  const code = fs.readFileSync(filePath, "utf8");
  // Generate the AST using Babel parser with plugins for modern features
  const ast = parse(code, {
    sourceType: "module",
    plugins: [
      "typescript",
      "jsx",
      "classProperties",
      "decorators-legacy",
      "optionalChaining",
      "nullishCoalescingOperator"
    ]
  });

  const functions: FunctionNode[] = [];
  const calls: CallEdge[] = [];
  // Map to link AST node object references to their unique string IDs
  const nodeIdMap = new Map<t.Node, string>();

  // Helper function to create and record a FunctionNode
  function addFunction(node: t.Function | t.ArrowFunctionExpression | t.ObjectMethod | t.ClassMethod, name: string | null) {
    const nid = idForNode(filePath, node);
    const loc = node.loc!;
    const f: FunctionNode = {
      id: nid,
      name,
      file: filePath,
      start: { line: loc.start.line, column: loc.start.column },
      end: { line: loc.end.line, column: loc.end.column }
    };
    functions.push(f);
    // Record the node-to-ID mapping
    nodeIdMap.set(node, nid);
    return nid;
  }

  // Use a try-catch block to specifically handle and bubble up errors during traversal
  try {
    // Start traversing the AST using the robustly imported 'traverse' function
    traverse(ast as any, {
      // The 'enter' method runs for every node
      enter(path: NodePath) {
        const node = path.node;

        // 1. Detect Function Declarations (function foo() {})
        if (t.isFunctionDeclaration(node)) {
          const name = node.id ? node.id.name : null;
          addFunction(node, name);
        }

        // 2. Detect Variable Declarations that define functions (const foo = () => {})
        if (t.isVariableDeclarator(node)) {
          if (t.isFunctionExpression(node.init) || t.isArrowFunctionExpression(node.init)) {
            const name = t.isIdentifier(node.id) ? node.id.name : null;
            addFunction(node.init as any, name);
          }
        }

        // 3. Detect Class and Object Methods (class { method() {} })
        if (t.isClassMethod(node) || t.isObjectMethod(node)) {
          const name = t.isIdentifier(node.key) ? node.key.name : null;
          addFunction(node as any, name);
        }

        // 4. Detect Function Calls (Call Expressions) -> Records Edges
        if (t.isCallExpression(node)) {
          // --- Find Caller (the 'from' node ID) ---
          let parent = path;
          let fromId: string | null = null;
          // Walk up the AST tree from the call expression
          while (parent && parent.node) {
            const n = parent.node;
            // Check if the current parent node is any kind of function definition
            if (
              t.isFunctionDeclaration(n) ||
              t.isFunctionExpression(n) ||
              t.isArrowFunctionExpression(n) ||
              t.isClassMethod(n) ||
              t.isObjectMethod(n)
            ) {
              // Check if this function node was already recorded
              const found = nodeIdMap.get(n);
              if (found) {
                fromId = found;
                break;
              }
              // If not recorded, record it now (handles cases where call precedes definition in AST)
              const loc = n.loc;
              if (loc) {
                fromId = idForNode(filePath, n);
                nodeIdMap.set(n, fromId);
                functions.push({
                  id: fromId,
                  name: (t.isFunctionDeclaration(n) && n.id) ? n.id.name : null,
                  file: filePath,
                  start: { line: loc.start.line, column: loc.start.column },
                  end: { line: loc.end.line, column: loc.end.column }
                });
                break;
              }
            }
            // Move up to the next parent node
            parent = parent.parentPath as any;
          }

          // --- Determine Callee Name ---
          let calleeName: string | null = null;
          const c = node.callee;
          // Get name if it's a simple identifier (e.g., foo())
          if (t.isIdentifier(c)) calleeName = c.name;
          // Get property name if it's a member expression (e.g., obj.method())
          else if (t.isMemberExpression(c)) {
            if (t.isIdentifier(c.property)) calleeName = c.property.name;
          }

          // --- Create Call Edge ---
          // Create a temporary 'to' placeholder ID based on filename and callee name.
          // This ID is temporary and requires the next phase (module resolution) to link it to a real FunctionNode ID.
          const toId = `${filePath}::callee:${calleeName ?? "anonymous"}:${node.loc ? node.loc.start.line : "0"}`;
          calls.push({
            from: fromId ?? `${filePath}:TOPLEVEL`, // If no caller is found, it's a top-level call
            to: toId,
            calleeName
          });
        }
      }
    });
  } catch (err) {
    // Re-throw any parsing/traversal errors to be caught and logged by parseProject
    throw err;
  }

  // Return the functions and calls found in this single file
  return { functions, calls, files: [filePath] };
}

// --- Exported Function: Project Aggregation ---

// Public function to walk an entire directory, parse all files, and combine results
export async function parseProject(rootPath: string): Promise<ParseResult> {
  // Get all files to be parsed
  const files = walkDir(rootPath);
  // Initialize the combined output structure
  const combined: ParseResult = { functions: [], calls: [], files: [] };

  // Loop through each file found
  for (const f of files) {
    try {
      // Parse the individual file
      const r = parseFile(f);
      // Merge results into the combined object
      combined.functions.push(...r.functions);
      combined.calls.push(...r.calls);
      combined.files.push(f);
    } catch (err) {
      // Log an error if parsing a specific file fails
      console.error(`Failed to parse ${f}:`, (err as Error).message);
    }
  }

  // Return the complete Intermediate Representation (IR)
  return combined;
}

// --- Main Execution Logic ---

// Wrapper function to handle main script execution and error handling
async function main() {
  console.log("Parser started!");
  const targetArg = process.argv[2];
  // Default sample path is relative to the current working directory (repo root when run via pnpm filter)
  const defaultSample = path.join(process.cwd(), "packages", "examples", "sample-node-express");
  // Set the target path, prioritizing the command line argument
  const target = targetArg ?? defaultSample;

  // Check if the final target path exists before proceeding (robustness check)
  if (!fs.existsSync(target)) {
    console.error("Target path does not exist:", target);
    console.error("Pass a path: pnpm --filter parser dev \"<path-to-repo>\"");
    process.exitCode = 1;
    return;
  }

  console.log("Parsing:", target);
  // Run the main parsing logic
  const res = await parseProject(target);
  // Output path: IR file written to the root of the project (one level up from packages/)
  const outPath = path.join(process.cwd(), "ir.json");
  fs.writeFileSync(outPath, JSON.stringify(res, null, 2));
  console.log("Wrote IR to", outPath, "functions:", res.functions.length, "calls:", res.calls.length);
}

// Check if the script is being run directly (the classic CommonJS approach is used here)
if (require.main === module) {
  // Call the main async function and catch any fatal errors
  main().catch((e) => {
    console.error("Fatal:", e && (e as Error).message);
    process.exit(1);
  });
}