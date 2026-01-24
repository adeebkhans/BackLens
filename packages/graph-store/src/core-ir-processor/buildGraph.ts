import { Graph, GraphNode, GraphEdge, FunctionNode, FileNode, ExternalNode, PlaceholderNode, ClassNode, MethodNode } from "./types";

// -- IR types (input) --

// Structure for a Class Node as output by the Parser (IR - Intermediate Representation)
export type IRClass = {
    id: string;
    name: string;
    file: string;
    start: { line: number; column: number };
    end: { line: number; column: number };
};

// Structure for a Method Node as output by the Parser (IR)
export type IRMethod = {
    id: string;
    name: string;
    className: string;
    classId: string;
    file: string;
    start: { line: number; column: number };
    end: { line: number; column: number };
};

// Structure for a Function Node as output by the Parser (IR)
export type IRFunction = {
    id: string;
    name: string | null;
    file: string;
    start: { line: number; column: number };
    end: { line: number; column: number };
};

// Structure for a Call Edge as output by the Parser (IR)
export type IRCall = {
    from: string;
    to: string;
    type?: "call" | "method_call";
    calleeName?: string | null;
    receiver?: string | null;
    method?: string | null;
    resolved?: boolean;
    external?: boolean;
    moduleName?: string | null;
};

export type IR = {
    functions: IRFunction[];
    classes?: IRClass[];
    methods?: IRMethod[];
    calls: IRCall[];
    files: string[];
    sourceRoot?: string;
};

// --- Build a graph from IR ---

/**
 * Build a Graph from the given IR.
 */
export function buildGraph(ir: IR): Graph {
    const nodes: Map<string, GraphNode> = new Map(); // id -> node
    const edges: Map<string, GraphEdge> = new Map(); // "from::to::type" -> edge

    // --- helpers ---
    const addNode = (n: GraphNode) => {
        if (!nodes.has(n.id)) nodes.set(n.id, n);
        return nodes.get(n.id)!;
    };

    const addEdge = (e: GraphEdge) => {
        const key = `${e.from}::${e.to}::${e.type}`;
        if (!edges.has(key)) edges.set(key, e);
    };

    // 0) Create Class Nodes (before file/function processing for proper hierarchy)
    if (ir.classes) {
        for (const cls of ir.classes) {
            const node: ClassNode = {
                id: cls.id,
                type: "class",
                label: cls.name,
                meta: {
                    file: cls.file,
                    name: cls.name,
                    start: cls.start,
                    end: cls.end
                }
            };
            addNode(node);

            // containment edge: file -> class
            const fileId = `file:${cls.file}`;
            if (nodes.has(fileId)) {
                addEdge({ from: fileId, to: cls.id, type: "contains" });
            }
        }
    }

    // 0b) Create Method Nodes
    if (ir.methods) {
        for (const method of ir.methods) {
            const node: MethodNode = {
                id: method.id,
                type: "method",
                label: `${method.className}.${method.name}`,
                meta: {
                    file: method.file,
                    className: method.className,
                    methodName: method.name,
                    start: method.start,
                    end: method.end
                }
            };
            addNode(node);

            // containment edge: class -> method
            if (nodes.has(method.classId)) {
                addEdge({ from: method.classId, to: method.id, type: "contains" });
            }
        }
    }

    // 1) Create File Nodes
    for (const file of ir.files) {
        const id = `file:${file}`;
        const fn: FileNode = {
            id,
            type: "file",
            label: file, // Label is the file path
            meta: { path: file }
        };
        addNode(fn);

        // Ensure any classes from this file are contained in it
        if (ir.classes) {
            for (const cls of ir.classes) {
                if (cls.file === file && !Array.from(edges.values()).some(e => e.from === id && e.to === cls.id)) {
                    addEdge({ from: id, to: cls.id, type: "contains" });
                }
            }
        }
    }

    // 2) Create Function nodes and containment edges
    for (const fn of ir.functions) {
        const node: FunctionNode = {
            id: fn.id, // Use the stable ID from the parser
            type: "function",
            label: fn.name ?? fn.id, // Display name or ID if anonymous
            meta: {
                file: fn.file, // path to file
                name: fn.name,
                start: fn.start,
                end: fn.end
            }
        };
        addNode(node);

        // containment edge: file -> function
        const fileId = `file:${fn.file}`;
        if (nodes.has(fileId)) {
            addEdge({ from: fileId, to: node.id, type: "contains" });
        } else {
            // if file node missing, create it
            addNode({
                id: fileId,
                type: "file",
                label: fn.file,
                meta: { path: fn.file }
            });
            addEdge({ from: fileId, to: node.id, type: "contains" });
        }
    }

    // 3) Process all IR call edges and create final edges + external / placeholder nodes
    for (const call of ir.calls) {
        // --- Determine Caller ('from') Node --- 
        // call.from may be file:TOPLEVEL or a function id
        const from = call.from;
        let fromNodeId = from;
        if (from.endsWith(":TOPLEVEL")) {
            // If the caller is TOPLEVEL (code outside any function)
            // map X:TOPLEVEL -> file node id
            const filePart = from.replace(/:TOPLEVEL$/, ""); // Extract the file path
            fromNodeId = `file:${filePart}`; // The caller is the File Node itself
            // ensure file node exists
            if (!nodes.has(fromNodeId)) {
                addNode({ id: fromNodeId, type: "file", label: filePart, meta: { path: filePart } });
            }
        } else {
            // The caller is a regular function; ensure its node exists (should be guaranteed by step 2)
            if (!nodes.has(fromNodeId)) {
                // Fallback: If the IR is corrupt and a function is missing, create a placeholder node
                addNode({
                    id: fromNodeId,
                    type: "placeholder",
                    label: fromNodeId,
                    meta: { placeholderId: fromNodeId, calleeName: null, file: "unknown" }
                } as PlaceholderNode);
            }
        }

        // determine 'to' node
        const callType: "call" | "method_call" = call.type === "method_call" ? "method_call" : "call";

        // --- Framework Tagging ---

        // Identify known framework receivers (Express, etc.) and tag them as framework nodes
        const frameworkReceivers = ["res", "req", "app", "next", "router", "express"];
        // Known framework method names commonly used with Express/Node.js HTTP handling
        const frameworkMethods = ["json", "send", "status", "render", "redirect", "cookie", "clearCookie", "download", "end", "format", "get", "set", "type", "links", "location", "vary", "append", "attachment", "sendFile", "sendStatus", "jsonp", "use", "post", "put", "delete", "patch", "all", "route", "param", "listen"];
        let isFrameworkCall = false;
        // Check if receiver is a known framework object OR method is a known framework method on common receivers
        if (call.receiver && frameworkReceivers.includes(call.receiver)) {
            isFrameworkCall = true;
        }
        // Also tag as framework if it's a method call to a common Express/HTTP response method
        if (call.type === "method_call" && call.method && frameworkMethods.includes(call.method)) {
            // Additional check: common framework patterns where receiver might not be directly detected
            // (e.g., chained calls like res.status(200).json())
            if (call.receiver && (call.receiver === "res" || call.receiver === "req" || call.receiver === "app" || call.receiver === "router")) {
                isFrameworkCall = true;
            }
        }

        if (call.resolved && !call.external) {
            // Case A: Call is resolved to an internal function (Function -> Function)
            const to = call.to;
            // fallback: ensure destination exists; if not, create placeholder function
            if (!nodes.has(to)) {
                addNode({
                    id: to,
                    type: "placeholder",
                    label: to,
                    meta: { placeholderId: to, calleeName: null, file: "unknown" }
                } as PlaceholderNode);
            }
            // Create the final call edge with appropriate type
            const edgeMeta: any = { calleeName: call.calleeName ?? null, resolved: true };
            if (call.receiver) edgeMeta.receiver = call.receiver;
            if (call.method) edgeMeta.method = call.method;
            if (isFrameworkCall) edgeMeta.isFramework = true;
            addEdge({ from: fromNodeId, to, type: callType, meta: edgeMeta });
        } else if (call.external && call.moduleName) {
            // Case B: Call targets an external module method (e.g., jwt.verify(), bcrypt.hash())
            // Create a placeholder node that preserves the method-level granularity while tagging module info
            const placeholderId = call.to;
            if (!nodes.has(placeholderId)) {
                // Create the Placeholder Node with external module metadata
                const parts = (placeholderId as string).split("::");
                const meta: any = {
                    placeholderId,
                    external: true,
                    moduleName: call.moduleName,
                    isFramework: isFrameworkCall
                };
                if (parts.length >= 4) {
                    meta.file = parts[1];
                    meta.calleeName = parts[2];
                    meta.line = Number(parts[3]) || undefined;
                }
                // Add receiver and method info
                if (call.receiver) meta.receiver = call.receiver;
                if (call.method) meta.method = call.method;

                // Generate a descriptive label showing receiver.method() format
                let nodeLabel = meta.calleeName ? `${meta.calleeName}()` : placeholderId;
                if (call.receiver && call.method) {
                    nodeLabel = `${call.receiver}.${call.method}()`;
                }

                addNode({
                    id: placeholderId,
                    type: "placeholder",
                    label: nodeLabel,
                    meta
                } as PlaceholderNode);
            }
            // Create the call edge to the external method placeholder
            const edgeMeta: any = {
                calleeName: call.calleeName ?? null,
                external: true,
                moduleName: call.moduleName
            };
            if (call.receiver) edgeMeta.receiver = call.receiver;
            if (call.method) edgeMeta.method = call.method;
            if (isFrameworkCall) edgeMeta.isFramework = true;
            addEdge({ from: fromNodeId, to: placeholderId, type: callType, meta: edgeMeta });

            // Also ensure the external module node exists (for module-level queries)
            const extId = `external:${call.moduleName}`;
            if (!nodes.has(extId)) {
                const extNode: ExternalNode = {
                    id: extId,
                    type: "external",
                    label: call.moduleName,
                    meta: { moduleName: call.moduleName, isFramework: isFrameworkCall }
                };
                addNode(extNode);
            }
        } else {
            // Case C: Unresolved internal placeholder (Function -> Placeholder Node)
            const placeholderId = call.to;
            if (!nodes.has(placeholderId)) {
                // Create the Placeholder Node if it doesn't exist
                const parts = (placeholderId as string).split("::");
                // Decode the placeholder ID structure: placeholder::<file>::<callee>::<line> 
                const meta: any = { placeholderId };
                if (parts.length >= 4) {
                    meta.file = parts[1];
                    meta.calleeName = parts[2];
                    meta.line = Number(parts[3]) || undefined;
                }
                // Add receiver and method info for better frontend display
                if (call.receiver) meta.receiver = call.receiver;
                if (call.method) meta.method = call.method;
                if (isFrameworkCall) meta.isFramework = true;

                // Generate a better label for the node based on available info
                let nodeLabel = meta.calleeName ? `${meta.calleeName}()` : placeholderId;
                if (call.receiver && call.method) {
                    // For method calls, show receiver.method() format
                    nodeLabel = `${call.receiver}.${call.method}()`;
                }

                addNode({
                    id: placeholderId,
                    type: "placeholder",
                    label: nodeLabel,
                    meta
                } as PlaceholderNode);
            }
            // Create the call edge to the Placeholder Node
            const edgeMeta: any = { calleeName: call.calleeName ?? null, resolved: false };
            if (call.receiver) edgeMeta.receiver = call.receiver;
            if (call.method) edgeMeta.method = call.method;
            if (isFrameworkCall) edgeMeta.isFramework = true;
            addEdge({ from: fromNodeId, to: placeholderId, type: callType, meta: edgeMeta });
        }
    }

    // --- Final Output ---

    // convert maps to arrays and preserve sourceRoot for path rehydration
    const graph: Graph = {
        nodes: Array.from(nodes.values()),
        edges: Array.from(edges.values()),
        sourceRoot: ir.sourceRoot
    };

    return graph;
}
