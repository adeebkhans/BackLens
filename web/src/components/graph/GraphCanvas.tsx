/**
 * Main graph canvas using React Flow
 */
import { useCallback, useEffect } from 'react';
import ReactFlow, {
  Background, // The dotted grid background
  Controls, // The zoom/pan control buttons
  MiniMap, // Small navigator in the corner
  useNodesState, // Specialized hook for managing node arrays
  useEdgesState, // Specialized hook for managing edge arrays
  Connection,  // Type for connection events
  addEdge, // Utility to add edges
  Panel, // Container for custom UI on top of the canvas
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useGraphStore } from '../../store/graphStore';
import { nodeTypes } from './nodeTypes';

export function GraphCanvas() {
  const {
    nodes: storeNodes,
    edges: storeEdges,
    selectNode,
    loading,
    error
  } = useGraphStore();

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Sync store to React Flow (Whenever global store updates)
  useEffect(() => {
    console.log('GraphCanvas: syncing storeNodes to React Flow:', storeNodes);
    setNodes(storeNodes);
  }, [storeNodes, setNodes]);

  useEffect(() => {
    console.log('GraphCanvas: syncing storeEdges to React Flow:', storeEdges);
    setEdges(storeEdges);
  }, [storeEdges, setEdges]);

  // Memoized handler to create and save a new connection between two nodes
  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)), // params contain new connection
    [setEdges]
  );

  // Updates the Right Panel (Inspector) with that specific node's metadata 
  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: any) => {
      selectNode(node.data.node);
    },
    [selectNode]
  );

  return (
    <div className="h-full w-full relative bg-gray-100">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes} // uses custom renderers for different node types (func vs class vs file etc)
        fitView
        minZoom={0.01}
        maxZoom={4}
        attributionPosition="bottom-left"
      >
        <Background />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            switch (node.data.node?.type) {
              case 'function': return '#3b82f6';
              case 'file': return '#6b7280';
              case 'class': return '#a855f7';
              case 'method': return '#22c55e';
              case 'external': return '#f97316';
              default: return '#9ca3af';
            }
          }}
          zoomable
          pannable
        />

        {/* Loading toast */}
        {loading && (
          <Panel position="top-center">
            <div className="bg-blue-600 text-white px-4 py-2 rounded-md shadow-lg">
              Loading...
            </div>
          </Panel>
        )}

        {/* Error toast */}
        {error && (
          <Panel position="top-center">
            <div className="bg-red-600 text-white px-4 py-2 rounded-md shadow-lg">
              {error}
            </div>
          </Panel>
        )}

        {/* Empty state toast */}
        {!loading && nodes.length === 0 && (
          <Panel position="top-center">
            <div className="bg-gray-800 text-white px-6 py-4 rounded-md shadow-lg">
              <p className="font-medium mb-2">No nodes in graph</p>
              <p className="text-sm text-gray-300">
                Use the left panel to load hotspots or search for nodes
              </p>
            </div>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}