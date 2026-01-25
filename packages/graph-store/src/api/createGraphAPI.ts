import { openDb } from "../persistence/db";
import { NodeStore, PersistNode } from "../persistence/NodeStore";
import { EdgeStore } from "../persistence/EdgeStore";
import { filterNode, filterNodes } from "./filterUtils";
import { QueryOptions } from "./QueryOptions";
import {
    transitiveCallersFlat as tCallersFlatAlg,
    transitiveCallersTree as tCallersTreeAlg,
    transitiveCalleesFlat as tCalleesFlatAlg,
    transitiveCalleesTree as tCalleesTreeAlg,
    allPathsBetween as allPathsAlg,
    computeHotspots as hotspotsAlg
} from "../algorithms/traversal";
import type { GraphAPI, GraphNode, GraphEdge, ExpandedNode, FlatListResult, TreeResult, ChainResult, HotspotEntry, TreeNode, SemanticStats } from "./GraphAPI";

/* ---------- Utility Helpers ---------- */

// Type-narrowing helper to remove null/undefined after a map
const notNull = <T>(v: T | null | undefined): v is T => v != null;

/**
 * Convert a raw GraphNode/PersistNode into ExpandedNode form, extracting key metadata.
 */
function toExpanded(n: GraphNode | null): ExpandedNode | null {
    if (!n) return null;
    const meta = n.meta || {};
    return {
        id: n.id,
        type: n.type,
        label: n.label ?? null,
        file: typeof meta.file === "string" ? meta.file : null,
        name: typeof meta.name === "string" ? meta.name : null,
        start: meta.start ?? null,
        end: meta.end ?? null,
        meta
    };
}

/**
 * Resolve raw ids -> PersistNode[], apply filterNodes, and optionally expand.
 * This is the standardized pipeline for all flat list results.
 */
const buildFlatResult = (ids: string[], nodeStoreRef: NodeStore, opts: QueryOptions): FlatListResult => {
    const rawNodes = ids.map(id => nodeStoreRef.get(id) as PersistNode | null);
    const filtered = filterNodes(rawNodes, opts); // Apply include/exclude filters
    const res: FlatListResult = { raw: filtered.map(n => n.id) };

    if (opts.expanded ?? true) { // Default expanded is true
        res.expanded = filtered.map(n => toExpanded(n)).filter(notNull) as ExpandedNode[];
    }
    return res;
};

/* ---------- Factory ---------- */

/**
 * Factory for GraphAPI with built-in filtering, expansion, and advanced query support.
 */
export function createGraphAPI(dbPath: string): GraphAPI {
    const db = openDb(dbPath);
    const nodeStore = new NodeStore(db);
    const edgeStore = new EdgeStore(db);

    const DEFAULT_OPTIONS: QueryOptions = { expanded: true };

    /* -------------------- Core Metadata -------------------- */

    // Retrieves a single node using the optimized NodeStore DAO
    const getNode = (id: string): GraphNode | null => nodeStore.get(id);

    // Fuzzy search across node IDs, labels, and common metadata; also matches receiver aliases via edges
    const searchNodes = (q: string, options?: QueryOptions): GraphNode[] => {
        const like = `%${q}%`;
        const lowerQ = q.toLowerCase();

        // 1) Basic id/label LIKE search
        const baseStmt = db.prepare(`SELECT id, type, label, meta FROM nodes WHERE id LIKE ? OR label LIKE ?`);
        const baseRows = baseStmt.all(like, like) as { id: string; type: string; label: string | null; meta: string | null }[];
        const byIdOrLabel = baseRows.map(r => ({ id: r.id, type: r.type, label: r.label, meta: r.meta ? JSON.parse(r.meta) : null }));

        // Collect unique results by id
        const acc: Map<string, GraphNode> = new Map();
        for (const n of byIdOrLabel) acc.set(n.id, n);

        // 2) Metadata fields (moduleName, name) substring match
        const allNodeStmt = db.prepare(`SELECT id, type, label, meta FROM nodes`);
        const allNodeRows = allNodeStmt.all() as { id: string; type: string; label: string | null; meta: string | null }[];
        for (const r of allNodeRows) {
            const meta = r.meta ? JSON.parse(r.meta) : null;
            const mName = meta?.moduleName;
            const name = meta?.name;
            if (typeof mName === 'string' && mName.toLowerCase().includes(lowerQ)) {
                acc.set(r.id, { id: r.id, type: r.type, label: r.label, meta });
                continue;
            }
            if (typeof name === 'string' && name.toLowerCase().includes(lowerQ)) {
                acc.set(r.id, { id: r.id, type: r.type, label: r.label, meta });
                continue;
            }
        }

        // 3) Edge receiver alias match -> include destination nodes (e.g., 'jwt' -> external:jsonwebtoken)
        const edgeStmt = db.prepare(`SELECT to_id, meta FROM edges WHERE type = 'call' OR type = 'method_call'`);
        const edgeRows = edgeStmt.all() as { to_id: string; meta: string | null }[];
        for (const e of edgeRows) {
            const meta = e.meta ? JSON.parse(e.meta) : null;
            const receiver = meta?.receiver;
            const moduleName = meta?.moduleName;
            if ((typeof receiver === 'string' && receiver.toLowerCase().includes(lowerQ)) ||
                (typeof moduleName === 'string' && moduleName.toLowerCase().includes(lowerQ))) {
                const node = nodeStore.get(e.to_id) as any;
                if (node) {
                    acc.set(node.id, { id: node.id, type: node.type, label: node.label, meta: node.meta || null });
                }
            }
        }

        // 4) Return up to 100 results
        const results = Array.from(acc.values()).slice(0, 100);
        return options ? filterNodes(results as PersistNode[], options) : results;
    };

    // Get all nodes in the graph
    const getAllNodes = (options?: QueryOptions): GraphNode[] => {
        const stmt = db.prepare(`SELECT id, type, label, meta FROM nodes`);
        const rows = stmt.all() as { id: string; type: string; label: string | null; meta: string | null }[];
        const nodes = rows.map(r => ({ id: r.id, type: r.type, label: r.label, meta: r.meta ? JSON.parse(r.meta) : null }));
        return options ? filterNodes(nodes as PersistNode[], options) : nodes;
    };

    // Get all edges in the graph
    const getAllEdges = (): GraphEdge[] => {
        const stmt = db.prepare(`SELECT from_id, to_id, type, meta FROM edges`);
        const rows = stmt.all() as { from_id: string; to_id: string; type: string; meta: string | null }[];
        return rows.map(r => ({ from: r.from_id, to: r.to_id, type: r.type, meta: r.meta ? JSON.parse(r.meta) : null }));
    };

    // Get semantic analysis statistics
    const getSemanticStats = (): SemanticStats => {
        const nodes = getAllNodes();
        const edges = getAllEdges();

        return {
            totalNodes: nodes.length,
            totalEdges: edges.length,
            classes: nodes.filter(n => n.type === 'class').length,
            methods: nodes.filter(n => n.type === 'method').length,
            functions: nodes.filter(n => n.type === 'function').length,
            files: nodes.filter(n => n.type === 'file').length,
            methodCalls: edges.filter(e => e.type === 'method_call').length,
            functionCalls: edges.filter(e => e.type === 'call').length,
            frameworkCalls: edges.filter(e => e.meta?.isFramework).length
        };
    };

    /* -------------------- direct neighbors (filtered) -------------------- */

    const getCallers = (nodeId: string, options?: QueryOptions): FlatListResult => {
        const opts = { ...DEFAULT_OPTIONS, ...options };
        // Find raw IDs using SQL (both 'call' and 'method_call' edges)
        const rows = db.prepare(`SELECT from_id FROM edges WHERE to_id = ? AND (type = 'call' OR type = 'method_call')`).all(nodeId) as { from_id: string }[];
        const ids = rows.map(r => r.from_id);
        return buildFlatResult(ids, nodeStore, opts);
    };

    const getCallees = (nodeId: string, options?: QueryOptions): FlatListResult => {
        const opts = { ...DEFAULT_OPTIONS, ...options };
        // Both 'call' and 'method_call' edges for comprehensive results
        const rows = db.prepare(`SELECT to_id FROM edges WHERE from_id = ? AND (type = 'call' OR type = 'method_call')`).all(nodeId) as { to_id: string }[];
        const ids = rows.map(r => r.to_id);
        return buildFlatResult(ids, nodeStore, opts);
    };

    const getFunctionsInFile = (nodeId: string, options?: QueryOptions): FlatListResult => {
        const opts = { ...DEFAULT_OPTIONS, ...options };
        // Select contained node ids (edges.type = 'contains') via JOIN
        const rows = db.prepare(`
        SELECT n.id
        FROM edges e
        JOIN nodes n ON n.id = e.to_id
        WHERE e.from_id = ? AND e.type = 'contains'
  `).all(nodeId) as { id: string }[];
        const ids = rows.map(r => r.id);
        return buildFlatResult(ids, nodeStore, opts);
    };

    /* -------------------- transitive (flat + tree) -------------------- */

    const transitiveCallersFlat = (nodeId: string, options?: QueryOptions): FlatListResult => {
        const opts = { ...DEFAULT_OPTIONS, ...options };
        // Call core traversal algorithm, respecting maxDepth
        const ids = tCallersFlatAlg(db, nodeId, opts.maxDepth ?? 200);
        // Apply filters and expansion
        return buildFlatResult(ids, nodeStore, opts);
    };

    /**
     * Converts the raw recursive tree structure (id, children) into the structured TreeNode format,
     * applying filters and pruning branches along the way.
     */
    const buildFilteredTree = (treeRoot: any, nodeStoreRef: NodeStore, opts: QueryOptions): TreeResult => {
        const convert = (n: any, depth: number): TreeNode | null => {
            const rawNode = nodeStoreRef.get(n.id) as PersistNode | null;
            // 1. Apply type filters to the current node
            const filtered = filterNode(rawNode, opts);
            if (!filtered) return null; // Prune if node is filtered out

            // 2. Check depth limit (no children beyond maxDepth)
            if (depth >= (opts.maxDepth ?? Infinity)) {
                return { nodeId: n.id, node: opts.expanded ? toExpanded(filtered) : undefined, children: [] };
            }

            // 3. Recursively build children
            const children = (n.children || [])
                .map((c: any) => convert(c, depth + 1))
                .filter(notNull) as TreeNode[];

            return { nodeId: n.id, node: opts.expanded ? toExpanded(filtered) : undefined, children };
        };

        const rootNode = convert(treeRoot, 0);
        // Ensure root is returned even if the tree is empty after filtering
        if (!rootNode) return { root: { nodeId: treeRoot.id, node: undefined, children: [] } };
        return { root: rootNode };
    };

    const transitiveCallersTree = (nodeId: string, options?: QueryOptions): TreeResult => {
        const opts = { ...DEFAULT_OPTIONS, ...options };
        const tree = tCallersTreeAlg(db, nodeId, opts.maxDepth ?? 50);
        return buildFilteredTree(tree, nodeStore, opts);
    };

    const transitiveCalleesFlat = (nodeId: string, options?: QueryOptions): FlatListResult => {
        const opts = { ...DEFAULT_OPTIONS, ...options };
        const ids = tCalleesFlatAlg(db, nodeId, opts.maxDepth ?? 200);
        return buildFlatResult(ids, nodeStore, opts);
    };

    const transitiveCalleesTree = (nodeId: string, options?: QueryOptions): TreeResult => {
        const opts = { ...DEFAULT_OPTIONS, ...options };
        const tree = tCalleesTreeAlg(db, nodeId, opts.maxDepth ?? 50);
        return buildFilteredTree(tree, nodeStore, opts);
    };

    /* -------------------- call chains -------------------- */

    /**
     * Finds all call chains (simple paths) between two nodes, with filtering and expansion.
     */
    const allCallChains = (startId: string, targetId: string, options?: QueryOptions & { depthLimit?: number; maxPaths?: number }) => {
        const opts = { ...DEFAULT_OPTIONS, ...options };
        const depthLimit = options?.depthLimit ?? 20;
        const maxPaths = options?.maxPaths ?? 1000;

        // Algorithm finds all simple paths (raw IDs), respecting depth limits
        const rawPaths = allPathsAlg(db, startId, targetId, depthLimit).slice(0, maxPaths);

        if (!(opts.expanded ?? DEFAULT_OPTIONS.expanded)) {
            return rawPaths.map(p => ({ rawPath: p })) as ChainResult[];
        }

        return rawPaths.map(p => {
            // Expand and apply filters to each node in the path
            const expandedPath = p
                .map(id => filterNode(nodeStore.get(id) as PersistNode | null, opts))
                .filter(notNull)
                .map(n => toExpanded(n))
                .filter(notNull) as ExpandedNode[];

            return { rawPath: p, expandedPath } as ChainResult;
        }) as ChainResult[];
    };

    /* -------------------- hotspots (with filters) -------------------- */

    /**
     * Computes hotspots based on fan-in and fan-out, applying type filters and expansion.
     */
    const hotspots = (options?: QueryOptions & { top?: number }): HotspotEntry[] => {
        const opts = { ...DEFAULT_OPTIONS, ...options };
        const top = options?.top ?? 20;
        const raw = hotspotsAlg(db, top) as { incoming: { node: string; cnt: number }[]; outgoing: { node: string; cnt: number }[] };

        const incomingMap: Record<string, number> = {};
        const outgoingMap: Record<string, number> = {};
        for (const r of raw.incoming) incomingMap[r.node] = r.cnt;
        for (const r of raw.outgoing) outgoingMap[r.node] = r.cnt;

        const keys = new Set([...Object.keys(incomingMap), ...Object.keys(outgoingMap)]);
        const arr: HotspotEntry[] = [];

        for (const key of keys) {
            const inCount = incomingMap[key] ?? 0;
            const outCount = outgoingMap[key] ?? 0;
            const score = inCount * outCount;

            const rawNode = nodeStore.get(key) as PersistNode | null;
            // Apply type filter
            const filtered = filterNode(rawNode, opts);
            if (!filtered) continue;

            arr.push({
                nodeId: key,
                node: opts.expanded ?? DEFAULT_OPTIONS.expanded ? toExpanded(filtered) : undefined,
                in: inCount,
                out: outCount,
                score
            });
        }

        arr.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
        return arr.slice(0, top);
    };

    /* -------------------- close -------------------- */

    // Closes the underlying SQLite database connection
    const close = () => db.close();

    /* -------------------- return API -------------------- */

    const api: GraphAPI = {
        getNode,
        searchNodes,
        getAllNodes,
        getAllEdges,
        getCallers,
        getCallees,
        transitiveCallersFlat,
        transitiveCallersTree,
        transitiveCalleesFlat,
        transitiveCalleesTree,
        allCallChains,
        hotspots,
        getFunctionsInFile,
        getSemanticStats,
        close
    };

    return api;
}