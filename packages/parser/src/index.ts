// packages/parser/src/index.ts
import fs from "fs";
import path from "path";
import { parse } from "@babel/parser";
import * as traverseModule from "@babel/traverse";
const traverse: typeof traverseModule.default = (traverseModule as any).default ?? (traverseModule as any);
import type { NodePath } from "@babel/traverse";
import * as t from "@babel/types";

/**
 * Parser that:
 *  - extracts functions and calls per file
 *  - builds a global registry
 *  - resolves callee placeholders to real function IDs when possible
 *  - tags external calls (node_modules / external packages)
 *  - dedupes functions and edges
 *  - normalizes IDs to relative forward-slash paths
 */

/* ---------------------- Types ---------------------- */

type FunctionNode = {
  id: string; // normalized id
  name: string | null;
  file: string; // normalized relative file
  start: { line: number; column: number };
  end: { line: number; column: number };
};

type CallEdge = {
  from: string; // function id or file:TOPLEVEL
  to: string; // resolved function id OR placeholder
  calleeName?: string | null;
  resolved?: boolean;
  external?: boolean;
  moduleName?: string | null;
};

type FileParseData = {
  file: string; // normalized relative file
  functions: FunctionNode[];
  calls: CallEdge[];
  imports: Map<string, { importedName: string; source: string }>; // localName -> {importedName, source}. ex- import { hashPassword as hp } from './service' then hp is localname and hasspassword is imported name
  exports: Map<string, string[]>; // exportName -> [functionId,...] (within this file)
};

type ParseResult = {
  functions: FunctionNode[];
  calls: CallEdge[];
  files: string[];
};

/* ---------------------- Helpers ---------------------- */

// normalize file path to relative path from current working directory and use forward slashes
function normalizeFile(file: string) {
  const rel = path.relative(process.cwd(), path.resolve(file));
  return rel.split(path.sep).join("/");
}

// Recursively walks a directory, filtering by extensions and ignoring common non-source directories
function walkDir(
  dir: string,
  exts = [".ts", ".js", ".tsx", ".jsx"],
  ignoreDirs = ["node_modules", ".git", "dist", "build", "coverage"]
): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const full = path.join(dir, entry.name);

    // --- skip ignored directories ---
    if (entry.isDirectory()) {
      if (ignoreDirs.includes(entry.name)) continue;
      out.push(...walkDir(full, exts, ignoreDirs));
      continue;
    }

    // --- only pick source files ---
    if (exts.includes(path.extname(entry.name))) {
      out.push(full);
    }
  }

  return out;
}


// use node location to build an ID, then normalize file path
function idForNode(file: string, node: t.Node) {
  const loc = node.loc;
  if (!loc) return `${normalizeFile(file)}:unknown`;
  const raw = `${file}:${loc.start.line}:${loc.start.column}-${loc.end.line}:${loc.end.column}`;
  return normalizeFile(raw);
}

// resolve import source (relative) to an actual file path inside project if possible
function tryResolveImportFile(baseFile: string, source: string): string | null {
  // If source is a package name (no ./ or ../ relative path indicator) treat specially (external)
  if (!source.startsWith(".") && !source.startsWith("/")) {
    return null; // external module (node_module)
  }

  let resolved = source;
  // Resolve relative paths based on the base file's directory
  if (!path.isAbsolute(resolved)) resolved = path.resolve(path.dirname(baseFile), source);

  // List of possible file extensions and index files to check
  const candidates = [
    resolved,
    resolved + ".ts",
    resolved + ".tsx",
    resolved + ".js",
    resolved + ".jsx",
    path.join(resolved, "index.ts"),
    path.join(resolved, "index.tsx"),
    path.join(resolved, "index.js"),
    path.join(resolved, "index.jsx")
  ];

  // Check if any candidate file exists on disk
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return path.normalize(c);
  }
  return null; // failed to resolve
}

/* ------------------ Per-file parsing ------------------ */

function parseFileDetailed(filePath: string): FileParseData {
  // Parses a single file, extracting all functions, calls, imports, and exports

  const code = fs.readFileSync(filePath, "utf8");
  const ast = parse(code, {   // Generate AST with modern plugins enabled
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
  const nodeToId = new Map<t.Node, string>();
  const imports = new Map<string, { importedName: string; source: string }>(); // localName -> {importedName, source}
  const exports = new Map<string, string[]>(); // exportName -> [functionId...]

  // local dedupe set so recording same node twice won't duplicate
  const recordedFunctionIds = new Set<string>();

  // Helper to create and record a FunctionNode with built-in deduping
  function recordFunction(node: t.Function | t.ArrowFunctionExpression | t.ObjectMethod | t.ClassMethod, name: string | null) {
    const id = idForNode(filePath, node);
    if (recordedFunctionIds.has(id)) {
      nodeToId.set(node, id);
      return id;
    }
    const loc = node.loc!;
    const f: FunctionNode = {
      id,
      name,
      file: normalizeFile(filePath),
      start: { line: loc.start.line, column: loc.start.column },
      end: { line: loc.end.line, column: loc.end.column }
    };
    functions.push(f);
    nodeToId.set(node, id);
    recordedFunctionIds.add(id);
    return id;
  }

  // traverse AST
  traverse(ast as any, {
    // The 'enter' method runs for every node
    enter(path: NodePath) {
      const node = path.node;

      // --- IMPORTS (ESM) ---
      if (t.isImportDeclaration(node)) {
        const src = (node.source && (node.source as t.StringLiteral).value) || ""; // get the source ex- ./myFile
        for (const spec of node.specifiers) {
          // Named import: import { foo as fu } from 'bar'
          if (t.isImportSpecifier(spec)) {
            const localName = (spec.local as t.Identifier).name;
            const importedName = (spec.imported as t.Identifier).name;
            imports.set(localName, { importedName, source: src });
          }
          // Default import: import foo from 'bar'
          else if (t.isImportDefaultSpecifier(spec)) {
            const localName = (spec.local as t.Identifier).name;
            imports.set(localName, { importedName: "default", source: src });
          }
          // Namespace import: import * as foo from 'bar'
          else if (t.isImportNamespaceSpecifier(spec)) {
            const localName = (spec.local as t.Identifier).name;
            imports.set(localName, { importedName: "*", source: src });
          }
        }
      }

      // --- CommonJS require() patterns ---
      if (
        t.isVariableDeclarator(node) &&
        t.isCallExpression(node.init) &&
        t.isIdentifier(node.init.callee) &&
        node.init.callee.name === "require" // Detects const foo = require('bar')
      ) {
        const arg = node.init.arguments[0];
        if (t.isStringLiteral(arg)) {
          const src = arg.value;
          // Case: const foo = require('bar')
          if (t.isIdentifier(node.id)) {
            imports.set(node.id.name, { importedName: "default", source: src });
          }
          // Case: const { foo: bar } = require('baz')
          else if (t.isObjectPattern(node.id)) {
            for (const prop of node.id.properties) {
              if (t.isObjectProperty(prop) && t.isIdentifier(prop.key) && t.isIdentifier(prop.value)) {
                // Map the local variable name (prop.value) to the exported name (prop.key)
                imports.set((prop.value as t.Identifier).name, { importedName: (prop.key as t.Identifier).name, source: src });
              }
            }
          }
        }
      }

      // --- EXPORTS ---
      if (t.isExportNamedDeclaration(node)) {
        // Case 1: export function foo() {} or export const foo = ...
        if (node.declaration) {
          const decl = node.declaration;
          // Sub-Case 1a: It is an exported Function Declaration (e.g., 'export function foo() {}')
          if (t.isFunctionDeclaration(decl)) {
            const name = decl.id ? decl.id.name : null;
            // Record the function details and get its unique ID
            const id = recordFunction(decl, name);
            // Map the exported name to its unique ID in the exports collection (exportName -> [functionId...])
            if (name) exports.set(name, [...(exports.get(name) || []), id]);
          }
          // Sub-Case 1b: It is an exported Variable Declaration (e.g., 'export const foo = () => {}')
          else if (t.isVariableDeclaration(decl)) {
            // A variable declaration can have multiple variables (e.g., 'export const a=1, b=2;')
            for (const d of decl.declarations) {
              if (t.isVariableDeclarator(d) && (t.isFunctionExpression(d.init) || t.isArrowFunctionExpression(d.init))) {
                const name = t.isIdentifier(d.id) ? d.id.name : null;
                const id = recordFunction(d.init as any, name);
                if (name) exports.set(name, [...(exports.get(name) || []), id]);
              }
            }
          }
        } else {
          // Case 2: export {foo} or export { foo as bar }, export { foo as bar } from './otherFile' 
          for (const spec of node.specifiers || []) {
            if (t.isExportSpecifier(spec)) {
              const exportedName = (spec.exported as t.Identifier).name;
              const localName = (spec.local as t.Identifier).name;
              // store temporary placeholder (sentinel) to resolve after traversal
              // The actual resolution of where 'foo' is defined will happen in a later pass, 
              // after the entire AST traversal is complete and all local imports/declarations are known.
              exports.set(exportedName, [`__LOCAL__:${localName}`]);
            }
          }
        }
      }

      // Case 3: export default foo or 'export default function() {}'
      if (t.isExportDefaultDeclaration(node)) {
        const decl = node.declaration;
        // Sub-Case 3a: 'export default function foo() {}' (named function) or 'export default function() {}' (anonymous function)
        if (t.isFunctionDeclaration(decl)) {
          const id = recordFunction(decl, decl.id ? decl.id.name : "default");
          exports.set("default", [...(exports.get("default") || []), id]);
        }
        // Sub-Case 3b: 'export default foo' where 'foo' is an existing variable/identifier
        else if (t.isIdentifier(decl)) {
          // Store a placeholder (sentinel) indicating that the value for "default" 
          // is the local variable 'foo'. This will be resolved later.
          exports.set("default", [`__LOCAL__:${decl.name}`]);
        }
        // Sub-Case 3c: 'export default () => {}' (arrow function) or 'export default function() {}' (function expression)
        else if (t.isArrowFunctionExpression(decl) || t.isFunctionExpression(decl)) {
          const id = recordFunction(decl as any, null);
          exports.set("default", [...(exports.get("default") || []), id]);
        }
      }

      // --- GENERAL FUNCTION CAPTURE (Catch all non-exported internal functions) ---

      // Case: function internalFoo() {}
      if (t.isFunctionDeclaration(node)) {
        const name = node.id ? node.id.name : null;
        recordFunction(node, name);
      }

      // Case: const internalBar = () => {}
      if (t.isVariableDeclarator(node)) {
        if (t.isFunctionExpression(node.init) || t.isArrowFunctionExpression(node.init)) {
          const name = t.isIdentifier(node.id) ? node.id.name : null;
          recordFunction(node.init as any, name);
        }
      }

      // Case: class MyClass { myMethod() {} } or const obj = { myMethod() {} }
      if (t.isClassMethod(node) || t.isObjectMethod(node)) {
        const name = t.isIdentifier(node.key) ? node.key.name : null;
        recordFunction(node as any, name);
      }

      // ------- CALL EXTRACT ------
      if (t.isCallExpression(node)) {
        // find enclosing function (caller)
        let parent = path;
        let fromId: string | null = null; // Stores the unique ID of the function making the call

        // Walk up the AST tree until we find a function definition that contains this call
        while (parent && parent.node) {
          const n = parent.node;

          // Check if the current parent node is any kind of function definition (declaration, arrow function, method, etc.)
          if (
            t.isFunctionDeclaration(n) ||
            t.isFunctionExpression(n) ||
            t.isArrowFunctionExpression(n) ||
            t.isClassMethod(n) ||
            t.isObjectMethod(n)
          ) {
            // Check if this function node was already recorded during earlier passes
            const found = nodeToId.get(n);
            if (found) {
              fromId = found;
              break;
            }

            // If not previously recorded, record it now
            const loc = n.loc;
            if (loc) {
              fromId = idForNode(filePath, n);
              nodeToId.set(n, fromId);
              // ensure functions list has it (dedup considered) ie. added to the global list of functions if it's new
              if (!recordedFunctionIds.has(fromId)) {
                const name = (t.isFunctionDeclaration(n) && n.id) ? n.id.name : null;
                functions.push({
                  id: fromId,
                  name,
                  file: normalizeFile(filePath),
                  start: { line: loc.start.line, column: loc.start.column },
                  end: { line: loc.end.line, column: loc.end.column }
                });
                recordedFunctionIds.add(fromId);
              }
              break;
            }
          }
          parent = parent.parentPath as any;
        }

        // Determine the name of the function being called (the 'callee')
        let calleeName: string | null = null;
        let calleeObject: string | null = null; // for namespace/member resolution (e.g., 'svc' in svc.saveUser)
        const c = node.callee; // The expression being called (the part before the parenthesis)
        if (t.isIdentifier(c)) {
          calleeName = c.name; // e.g., 'hashPassword()' -> calleeName = 'hashPassword'
        } else if (t.isMemberExpression(c)) {
          // e.g., 'userSvc.saveUser()' -> calleeName = 'saveUser', calleeObject = 'userSvc'
          if (t.isIdentifier(c.property)) calleeName = c.property.name;
          if (t.isIdentifier(c.object)) calleeObject = c.object.name;
        }

        // Create a temporary ID placeholder for the 'to' side of the call (the callee target)
        // Format: placeholder::<relative file>::<callee name>::<line number>
        // This temporary ID will be resolved to a final function ID in the next processing phase (Pass 2)
        const pl = `placeholder::${normalizeFile(filePath)}::${calleeName ?? "anonymous"}::${node.loc ? node.loc.start.line : 0}`;
        calls.push({
          from: fromId ?? `${normalizeFile(filePath)}:TOPLEVEL`,
          to: pl,
          calleeName,
          resolved: false // Explicitly marked as unresolved, awaiting Pass 2
        });
      }
    }
  });

  // resolve local __LOCAL__ exports sentinel (Post-traversal Pass 1.5)
  // ((After the AST traversal is complete, this loop resolves temporary placeholders
  // created by syntax like `export { myFunc }`. It links the export name 
  // to the actual stable function ID recorded earlier in the `functions` list.))
  for (const [expName, ids] of Array.from(exports.entries())) {
    const resolved: string[] = []; // Array to hold the final, stable IDs
    for (const v of ids) {
      if (typeof v === "string" && v.startsWith("__LOCAL__:")) {
        const localName = v.slice("__LOCAL__:".length); // Extract the local variable name (e.g., 'foo')
        // Find the stable, unique ID of the function named 'localName' within this specific file
        for (const fn of functions) {
          if (fn.name === localName) resolved.push(fn.id);
        }
      } else { // If it wasn't a sentinel (it was a direct export of a function definition),
        resolved.push(v);
      }
    }
    exports.set(expName, resolved);
  }

  // This structure will be consumed by a subsequent "Pass 2" that connects these files together
  return {
    file: normalizeFile(filePath),
    functions,
    calls,
    imports,
    exports
  };
}

/* ------------------ Project-level aggregation & resolution ------------------ */

// Orchestrates the two-pass analysis: first parsing all files individually, 
// then resolving cross-file calls in a second pass.

export async function parseProject(rootPath: string): Promise<ParseResult> {
  // Step 1: Find all relevant source files starting from the root directory
  const files = walkDir(rootPath);

  // Map to hold the detailed parse data (IR) for every file, indexed by file path
  const fileData: Map<string, FileParseData> = new Map();

  // PASS 1: Parse all files and collect data locally within each file (Functions, Imports, Exports, Calls w/ placeholders)
  for (const f of files) {
    try {
      const pd = parseFileDetailed(f);
      fileData.set(pd.file, pd);
    } catch (err) {
      console.error(`Failed to parse ${f}:`, (err as Error).message);
    }
  }

  // Build a global registry map of all functions accessible by name (for efficient resolution later) (name -> function nodes)
  const functionRegistry = new Map<string, FunctionNode[]>();
  for (const pd of fileData.values()) {
    // Index functions by their defined local name
    for (const fn of pd.functions) {
      if (!fn.name) continue;
      const arr = functionRegistry.get(fn.name) || [];
      arr.push(fn);
      functionRegistry.set(fn.name, arr);
    }
    // Index functions by their exported name (crucial for cross-file linking)
    for (const [expName, ids] of pd.exports.entries()) {
      for (const id of ids) {
        const fn = pd.functions.find((x) => x.id === id);
        if (fn) {
          const arr = functionRegistry.get(expName) || [];
          arr.push(fn);
          functionRegistry.set(expName, arr);
        }
      }
    }
  }

  // Initialize final output arrays, preparing for deduplication across all files
  const seenFunctionIds = new Set<string>();
  const allFunctions: FunctionNode[] = [];
  const seenCallKeys = new Set<string>();
  const allCalls: CallEdge[] = [];

  // Helper function to add a call edge to the final list while preventing exact duplicates
  function pushCall(call: CallEdge) {
    // Create a unique key for the call based on all its properties
    const key = `${call.from}::${call.to}::${call.calleeName ?? ""}::${call.moduleName ?? ""}::${!!call.external}`;
    if (seenCallKeys.has(key)) return;
    seenCallKeys.add(key);
    allCalls.push(call);
  }

  // Add all discovered functions to the final list in a deterministic order (by file path)
  for (const pd of fileData.values()) {
    for (const fn of pd.functions) {
      if (seenFunctionIds.has(fn.id)) continue;
      seenFunctionIds.add(fn.id);
      allFunctions.push(fn);
    }
  }

  // PASS 2: Resolve all call edges using the global context
  // Iterate through every call that was recorded in every file
  for (const pd of fileData.values()) {
    for (const call of pd.calls) {
      const name = call.calleeName;
      const placeholderTo = call.to; // The temporary ID created in Pass 1

      let resolvedId: string | null = null;
      let external = false;
      let moduleName: string | null = null;

      if (!name) {
        pushCall(call); // Cannot resolve calls where the function name is anonymous (e.g., IIFE), keep as is
        continue;
      }

      // If placeholder was a member expression and object present (e.g., svc.save),
      // attempt to resolve via namespace import: if 'svc' is a namespace import, we can't pick single function.
      // We captured calleeObject during parse only locally, available via placeholder naming? Not stored — we rely on imports map.

      // 1) RESOLVE VIA IMPORT: Check if the callee name was locally imported in this file
      const importInfo = pd.imports.get(name);
      if (importInfo) {
        // If source is external (package name) -> mark external
        const src = importInfo.source;
        const resolvedFile = tryResolveImportFile(path.resolve(process.cwd(), pd.file), src);
        if (!resolvedFile) {
          // external module: tag external
          external = true;
          moduleName = src;
        } else {
          // If the import points to another internal project file, find its parse data
          const norm = normalizeFile(resolvedFile);
          const targetPd = fileData.get(norm);
          if (targetPd) {
            const importedName = importInfo.importedName;
            // Handle different import types and look up the exact exported function ID
            if (importedName === "*") {
              // namespace import: ambiguous — we cannot resolve specific function without deeper analysis (e.g., import * as svc from './service')
            } else if (importedName === "default") {
              // Default import - Look up the 'default' export in the target file's exports
              const exported = targetPd.exports.get("default") || [];
              if (exported.length === 1) resolvedId = exported[0];
              else if (exported.length > 1) resolvedId = exported[0]; // Take the first if multiple (shouldn't happen for default)
              else {
                // fallback local function in that file named 'default' (unlikely)
                const fn = targetPd.functions.find((x) => x.name === "default");
                if (fn) resolvedId = fn.id;
              }
            } else {
              // named import -> check exports mapping or local function
              const exported = targetPd.exports.get(importedName);
              if (exported && exported.length > 0) {
                resolvedId = exported[0]; // Link to the stable ID found in Pass 1.5
              } else {
                // Fallback: search for a function named exactly the imported name locally
                const fn = targetPd.functions.find((x) => x.name === importedName);
                if (fn) resolvedId = fn.id;
              }
            }
          }
        }
      }

      // 2) LOCAL RESOLUTION: If not resolved via import path, check local functions in the same file
      if (!resolvedId) {
        const localFn = pd.functions.find((x) => x.name === name);
        if (localFn) resolvedId = localFn.id;
      }

      // 3) Global unique name fallback: If still unresolved, check the global registry 
      if (!resolvedId) {
        const candidates = functionRegistry.get(name) || [];
        if (candidates.length === 1) resolvedId = candidates[0].id;
      }

      // Final action: Push the call edge to the master list
      if (resolvedId) {
        // Success: Call is fully resolved to a permanent target ID
        pushCall({ ...call, to: resolvedId, resolved: true, external: false, moduleName: null });
      } else if (external) {
        // External call: Mark as such and keep the module name for reference
        pushCall({ ...call, resolved: false, external: true, moduleName });
      } else {
        // unresolved internal placeholder -> keep placeholder (but normalized) (e.g., due to dynamic calls, multiple candidates)
        // normalize placeholder id to be stable
        const normalizedPlaceholder = placeholderTo.split(path.sep).join("/");
        pushCall({ ...call, to: normalizedPlaceholder, resolved: false, external: false, moduleName: null });
      }
    }
  }

  const filesList = Array.from(fileData.keys());
  return {
    functions: allFunctions,
    calls: allCalls,
    files: filesList
  };
}

/* ------------------ CLI Entrypoint ------------------ */

// Wrapper function to handle main script execution and error handling
async function main() {
  console.log("Parser started!");
  const targetArg = process.argv[2];
  // default sample (project-relative)
  const defaultSample = path.join(process.cwd(), "examples", "sample-node-express");
  const target = targetArg ?? defaultSample;

  // Check if the target path exists (prevents ENOENT errors)
  if (!fs.existsSync(target)) {
    console.error("Target path does not exist:", target);
    console.error("Pass a path: pnpm --filter parser dev \"<path-to-repo>\"");
    process.exitCode = 1;
    return;
  }

  console.log("Parsing:", target);
  const res = await parseProject(target);
  const outPath = path.join(process.cwd(), "ir.json");
  fs.writeFileSync(outPath, JSON.stringify(res, null, 2));
  console.log("Wrote IR to", outPath, "functions:", res.functions.length, "calls:", res.calls.length);
}

if (require.main === module) {
  main().catch((e) => {
    console.error("Fatal:", e && (e as Error).message);
    process.exit(1);
  });
}

// run 
// pnpm --filter parser dev 
// or with path
// pnpm --filter parser dev "path/to/project"