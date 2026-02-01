/**
 * Graph State Engine using Zustand store for graph state management
 */
import { create } from 'zustand';
import type { Node, Edge } from 'reactflow';
import { MarkerType } from 'reactflow';
import type { GraphNode } from '../types/graph';
import { graphApi } from '../api/graphApi';

// Layout constants
const NODE_WIDTH = 250;
const NODE_HEIGHT = 120;
const HORIZONTAL_SPACING = 350; // Distance between caller/callee columns
const VERTICAL_SPACING = 180;
const MAX_NODES_PER_COLUMN = 5; // Limit nodes per column to avoid long vertical lines

/**
 * Helper: Calculates the next open coordinate in a grid to prevent node overlapping
 * Iterates through a column top-to-bottom before moving to the next horizontal offset.
 */
function findFirstAvailablePositionGrid(
  existingNodes: Node[],
  baseX: number,
  startY: number,
  direction: 'left' | 'right' = 'right'
): { x: number; y: number } {
  // Determine horizontal growth direction (-1 for left, 1 for right)
  const xMultiplier = direction === 'left' ? -1 : 1;
  let columnOffset = 0;
  let rowIndex = 0;

  while (true) {
    // Calculate potential coordinates based on current grid indices
    const x = baseX + (columnOffset * HORIZONTAL_SPACING * xMultiplier);
    const y = startY + (rowIndex * VERTICAL_SPACING);

    // Check collision at this position
    const isOccupied = existingNodes.some(node => {
      const dx = Math.abs(node.position.x - x);
      const dy = Math.abs(node.position.y - y);
      // Use 90% threshold of node dimensions to allow tight but clear spacing
      return dx < NODE_WIDTH * 0.9 && dy < NODE_HEIGHT * 0.9;
    });

    if (!isOccupied) {
      return { x, y };
    }

    // Move to next position in grid (down, then next column)
    rowIndex++;
    if (rowIndex >= MAX_NODES_PER_COLUMN) {
      rowIndex = 0;
      columnOffset++;
    }
  }
}

/**
 * Helper: Place a batch of nodes in a grid layout without overlaps.
 * Uses multiple columns for better visual distribution.
 */
function placeBatchInGrid<T>(
  existingNodes: Node[],
  items: T[],
  baseX: number,
  startY: number,
  direction: 'left' | 'right' = 'right'
): Array<{ item: T; position: { x: number; y: number } }> {
  // Use a local working set that we mutate as we place nodes
  const occupied: Node[] = [...existingNodes];

  return items.map((item) => {
    const position = findFirstAvailablePositionGrid(occupied, baseX, startY, direction);
    // Push a minimal node-like shape so subsequent placements see it as occupied
    occupied.push({ id: `__placed__${occupied.length}`, position } as any);
    return { item, position };
  });
}

/**
 * Helper: Get position of a node by ID
 */
function getNodePosition(nodes: Node[], nodeId: string): { x: number; y: number } | null {
  const node = nodes.find(n => n.id === nodeId);
  return node ? node.position : null;
}

// Tracking Map for expanded nodes to avoid redundant API calls
interface ExpandedState {
  [nodeId: string]: {
    callers?: boolean;
    callees?: boolean;
  };
}

// Zustand store interface
interface GraphStore {
  // State
  nodes: Node[];
  edges: Edge[];
  expanded: ExpandedState;
  selectedNode: GraphNode | null;
  loading: boolean;
  error: string | null;

  // Actions
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  addNodes: (nodes: Node[]) => void;
  addEdges: (edges: Edge[]) => void;
  selectNode: (node: GraphNode | null) => void;
  clearGraph: () => void;

  // API-connected actions
  loadHotspots: (top?: number) => Promise<void>;
  loadHotspotNode: (nodeId: string) => Promise<void>;
  expandCallers: (nodeId: string) => Promise<void>;
  expandCallees: (nodeId: string) => Promise<void>;
  searchAndAddNode: (query: string) => Promise<void>;
  addNode: (node: GraphNode) => void;
  removeNode: (nodeId: string) => void;
}

export const useGraphStore = create<GraphStore>((set, get) => ({
  // Initial state
  nodes: [],
  edges: [],
  expanded: {},
  selectedNode: null,
  loading: false,
  error: null,

  // Basic setters
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  addNodes: (newNodes) => set((state) => {
    const existingIds = new Set(state.nodes.map(n => n.id));
    const uniqueNewNodes = newNodes.filter(n => !existingIds.has(n.id));
    return { nodes: [...state.nodes, ...uniqueNewNodes] }; // append unique nodes to existing nodes in store
  }),

  addEdges: (newEdges) => set((state) => {
    const existingEdgeIds = new Set(state.edges.map(e => `${e.source}-${e.target}`));
    const uniqueNewEdges = newEdges.filter(
      e => !existingEdgeIds.has(`${e.source}-${e.target}`)
    );
    return { edges: [...state.edges, ...uniqueNewEdges] };
  }),

  selectNode: (node) => set((state) => {
    // Update edges to highlight those connected to the selected node
    const edges = state.edges.map(edge => {
      const isConnected = node && (edge.source === node.id || edge.target === node.id);

      if (isConnected) {
        // Highlight connected edges with higher opacity and thicker stroke
        return {
          ...edge,
          style: {
            ...edge.style,
            strokeWidth: 3,
            strokeOpacity: 1,
          },
        };
      } else {
        // Dim non-connected edges when a node is selected
        const baseColor = edge.data?.edgeType === 'caller' ? '#3b82f6' : '#10b981';
        return {
          ...edge,
          style: {
            ...edge.style,
            stroke: baseColor,
            strokeWidth: 2,
            strokeOpacity: node ? 0.3 : 0.6, // Dim if something is selected, normal if nothing selected
          },
        };
      }
    });

    return { selectedNode: node, edges };
  }),

  removeNode: (nodeId) => set((state) => {
    // collect neighbors to clear their expansion state so re-expansion will trigger API again
    const neighborIds = new Set<string>();
    state.edges.forEach(e => {
      if (e.source === nodeId) neighborIds.add(e.target);
      if (e.target === nodeId) neighborIds.add(e.source);
    });

    const nodes = state.nodes.filter(n => n.id !== nodeId);
    const edges = state.edges.filter(e => e.source !== nodeId && e.target !== nodeId);
    const expanded = { ...state.expanded } as ExpandedState;
    delete expanded[nodeId];
    neighborIds.forEach(id => { delete expanded[id]; });
    const selectedNode = state.selectedNode?.id === nodeId ? null : state.selectedNode;
    return { nodes, edges, expanded, selectedNode };
  }),

  clearGraph: () => set({
    nodes: [],
    edges: [],
    expanded: {},
    selectedNode: null
  }),

  // Load initial hotspots and initializes them in a multi-column grid with attached interaction handlers (not used rn)
  loadHotspots: async (top = 10) => {
    set({ loading: true, error: null });
    try {
      const hotspots = await graphApi.getHotspots(top, {
        expanded: true,
        includeTypes: ['function']
      });

      console.log('Fetched hotspots:', hotspots);

      // Hotspots response has structure: { nodeId, node, in, out, score }
      const nodes: Node[] = hotspots.map((hotspot, index) => ({
        id: hotspot.node.id,
        type: 'custom',
        position: {
          x: 100 + (index % 3) * 300, // creates three columns (0, 1, 2) spaced 300 pixels apart
          y: 100 + Math.floor(index / 3) * 200 // moves to a new row every 3 nodes, spaced 200 pixels apart
        },
        data: {
          node: hotspot.node,
          onExpandCallers: () => get().expandCallers(hotspot.node.id),
          onExpandCallees: () => get().expandCallees(hotspot.node.id),
          onDelete: () => get().removeNode(hotspot.node.id),
          onLoadHotspot: () => get().loadHotspotNode(hotspot.node.id),
        },
      }));

      console.log('Created React Flow nodes:', nodes);

      set({ nodes, loading: false });
    } catch (error) {
      console.error('Error loading hotspots:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to load hotspots',
        loading: false
      });
    }
  },

  // Load a single hotspot node with 1-hop expansion (callers + callees)
  loadHotspotNode: async (nodeId: string) => {
    set({ loading: true, error: null });
    try {
      // Clear existing graph
      get().clearGraph();

      // Fetch the node details
      const node = await graphApi.getNode(nodeId);
      if (!node) {
        set({ error: 'Node not found', loading: false });
        return;
      }

      // Fetch callers and callees in parallel
      const [callersResult, calleesResult] = await Promise.all([
        graphApi.getCallers(nodeId, { expanded: true, excludeTypes: ['file'] }),
        graphApi.getCallees(nodeId, { expanded: true, excludeTypes: ['file'] })
      ]);

      // Create center node
      const centerNode: Node = {
        id: node.id,
        type: 'custom',
        position: { x: 400, y: 300 },
        data: {
          node,
          onExpandCallers: () => get().expandCallers(node.id),
          onExpandCallees: () => get().expandCallees(node.id),
          onDelete: () => get().removeNode(node.id),
        },
      };

      // Place callers/callees in collision-aware columns around the center
      const seededOccupied: Node[] = [centerNode];

      const callerPlacements = placeBatchInGrid(
        seededOccupied,
        callersResult.expanded,
        centerNode.position.x - HORIZONTAL_SPACING, // so that callers start from left column
        centerNode.position.y - VERTICAL_SPACING,
        'left'
      );
      const callerNodes: Node[] = callerPlacements.map(({ item: caller, position }) => ({
        id: caller.id,
        type: 'custom',
        position,
        data: {
          node: caller,
          onExpandCallers: () => get().expandCallers(caller.id),
          onExpandCallees: () => get().expandCallees(caller.id),
          onDelete: () => get().removeNode(caller.id),
        },
      }));

      // include callers as occupied before placing callees
      const occupiedWithCallers: Node[] = [centerNode, ...callerNodes];

      const calleePlacements = placeBatchInGrid(
        occupiedWithCallers,
        calleesResult.expanded,
        centerNode.position.x + HORIZONTAL_SPACING, // so that callees start from right column
        centerNode.position.y - VERTICAL_SPACING,
        'right'
      );
      const calleeNodes: Node[] = calleePlacements.map(({ item: callee, position }) => ({
        id: callee.id,
        type: 'custom',
        position,
        data: {
          node: callee,
          onExpandCallers: () => get().expandCallers(callee.id),
          onExpandCallees: () => get().expandCallees(callee.id),
          onDelete: () => get().removeNode(callee.id),
        },
      }));

      // Create edges from callers to center
      const callerEdges: Edge[] = callersResult.expanded.map((caller) => ({
        id: `${caller.id}-${nodeId}`,
        source: caller.id,
        target: nodeId,
        type: 'default', // edge type (Bezier)
        animated: false,
        data: { edgeType: 'caller' },
        style: {
          stroke: '#3b82f6', // blue for callers
          strokeWidth: 2,
          strokeOpacity: 0.6
        },
        sourceHandle: 'right', // line exits from right side of caller
        targetHandle: 'left', // line enters from left side of center
        markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' }, // arrowhead
      }));

      // Create edges from center to callees
      const calleeEdges: Edge[] = calleesResult.expanded.map((callee) => ({
        id: `${nodeId}-${callee.id}`,
        source: nodeId,
        target: callee.id,
        type: 'default',
        animated: false,
        data: { edgeType: 'callee' },
        style: {
          stroke: '#10b981', // green for callees
          strokeWidth: 2,
          strokeOpacity: 0.6
        },
        sourceHandle: 'right',
        targetHandle: 'left',
        markerEnd: { type: MarkerType.ArrowClosed, color: '#10b981' },
      }));

      // Set all nodes and edges
      set({
        nodes: [centerNode, ...callerNodes, ...calleeNodes],
        edges: [...callerEdges, ...calleeEdges],
        expanded: {
          [nodeId]: { callers: true, callees: true }
        },
        selectedNode: node,
        loading: false,
      });
    } catch (error) {
      console.error('Error loading hotspot node:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to load hotspot node',
        loading: false,
      });
    }
  },

  // Expand callers
  expandCallers: async (nodeId: string) => {
    const { expanded } = get();

    // Check if already expanded
    if (expanded[nodeId]?.callers) {
      return;
    }

    set({ loading: true });
    try {
      const result = await graphApi.getCallers(nodeId, { expanded: true });
      const callerNodes = result.expanded;

      // Create nodes for callers
      const existingNodes = get().nodes;
      const targetPos = getNodePosition(existingNodes, nodeId);
      const baseX = targetPos ? targetPos.x - HORIZONTAL_SPACING : 100;
      const startY = targetPos ? targetPos.y - VERTICAL_SPACING : 100;

      const toAdd = callerNodes.filter(caller => !existingNodes.find(n => n.id === caller.id));
      const placements = placeBatchInGrid(existingNodes, toAdd, baseX, startY, 'left');
      const newNodes: Node[] = placements.map(({ item: caller, position }) => ({
        id: caller.id,
        type: 'custom',
        position,
        data: {
          node: caller,
          onExpandCallers: () => get().expandCallers(caller.id),
          onExpandCallees: () => get().expandCallees(caller.id),
          onDelete: () => get().removeNode(caller.id),
        },
      }));

      // Create edges from callers to target
      const newEdges: Edge[] = callerNodes.map((caller) => ({
        id: `${caller.id}-${nodeId}`,
        source: caller.id,
        target: nodeId,
        type: 'default',
        animated: false,
        data: { edgeType: 'caller' },
        style: {
          stroke: '#3b82f6',
          strokeWidth: 2,
          strokeOpacity: 0.6
        },
        sourceHandle: 'right',
        targetHandle: 'left',
        markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' },
      }));

      get().addNodes(newNodes);
      get().addEdges(newEdges);

      set((state) => ({
        expanded: {
          ...state.expanded,
          [nodeId]: { ...state.expanded[nodeId], callers: true }
        },
        loading: false
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to expand callers',
        loading: false
      });
    }
  },

  // Expand callees
  expandCallees: async (nodeId: string) => {
    const { expanded } = get();

    // Check if already expanded
    if (expanded[nodeId]?.callees) {
      return;
    }

    set({ loading: true });
    try {
      const result = await graphApi.getCallees(nodeId, { expanded: true });
      const calleeNodes = result.expanded;

      // Create nodes for callees
      const existingNodes = get().nodes;
      const targetPos = getNodePosition(existingNodes, nodeId);
      const baseX = targetPos ? targetPos.x + HORIZONTAL_SPACING : 700;
      const startY = targetPos ? targetPos.y - VERTICAL_SPACING : 100;

      const toAdd = calleeNodes.filter(callee => !existingNodes.find(n => n.id === callee.id));
      const placements = placeBatchInGrid(existingNodes, toAdd, baseX, startY, 'right');
      const newNodes: Node[] = placements.map(({ item: callee, position }) => ({
        id: callee.id,
        type: 'custom',
        position,
        data: {
          node: callee,
          onExpandCallers: () => get().expandCallers(callee.id),
          onExpandCallees: () => get().expandCallees(callee.id),
          onDelete: () => get().removeNode(callee.id),
        },
      }));

      // Create edges from target to callees
      const newEdges: Edge[] = calleeNodes.map((callee) => ({
        data: { edgeType: 'callee' },
        id: `${nodeId}-${callee.id}`,
        source: nodeId,
        target: callee.id,
        type: 'default',
        animated: false,
        style: {
          stroke: '#10b981',
          strokeWidth: 2,
          strokeOpacity: 0.6
        },
        sourceHandle: 'right',
        targetHandle: 'left',
        markerEnd: { type: MarkerType.ArrowClosed, color: '#10b981' },
      }));

      get().addNodes(newNodes);
      get().addEdges(newEdges);

      set((state) => ({
        expanded: {
          ...state.expanded,
          [nodeId]: { ...state.expanded[nodeId], callees: true }
        },
        loading: false
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to expand callees',
        loading: false
      });
    }
  },

  // Search and add node to graph
  searchAndAddNode: async (query: string) => {
    set({ loading: true, error: null });
    try {
      const results = await graphApi.searchNodes(query, 5);

      if (results.length === 0) {
        set({ error: 'No results found', loading: false });
        return;
      }

      const existingNodes = get().nodes;
      const toAdd = results.filter(result => !existingNodes.find(n => n.id === result.id));

      // Place search results using collision-aware grid placement
      const placements = placeBatchInGrid(existingNodes, toAdd, 100, 100);

      const newNodes: Node[] = placements.map(({ item: result, position }) => ({
        id: result.id,
        type: 'custom',
        position,
        data: {
          node: result,
          onExpandCallers: () => get().expandCallers(result.id),
          onExpandCallees: () => get().expandCallees(result.id),
          onDelete: () => get().removeNode(result.id),
        },
      }));

      get().addNodes(newNodes);
      set({ loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Search failed',
        loading: false
      });
    }
  },

  // Add a single GraphNode to the canvas
  addNode: (node: GraphNode) => {
    const existingNodes = get().nodes;

    // Check if node already exists
    if (existingNodes.find(n => n.id === node.id)) {
      return;
    }

    // Find available position
    const position = findFirstAvailablePositionGrid(existingNodes, 100, 100);

    const newNode: Node = {
      id: node.id,
      type: 'custom',
      position,
      data: {
        node,
        onExpandCallers: () => get().expandCallers(node.id),
        onExpandCallees: () => get().expandCallees(node.id),
        onDelete: () => get().removeNode(node.id),
      },
    };

    get().addNodes([newNode]);
    set({ selectedNode: node });
  },
}));