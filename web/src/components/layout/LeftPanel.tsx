/**
 * Left Panel - Entry Points, Search, and Class Hierarchy
 */
import { useState } from 'react';
import { useGraphStore } from '../../store/graphStore';
import { graphApi } from '../../api/graphApi';
import type { HotspotNode, GraphNode } from '../../types/graph';

// Tabs 
type TabType = 'hotspots' | 'classes' | 'files';

// Expanded class hierarchy type
interface ClassHierarchy {
  class: GraphNode;
  methods: GraphNode[];
  expanded: boolean;
}

export function LeftPanel() {
  const [searchQuery, setSearchQuery] = useState(''); // The text currently in the search input
  const [hotspots, setHotspots] = useState<HotspotNode[]>([]); // Array of results from the hotspot analysis
  const [classHierarchies, setClassHierarchies] = useState<ClassHierarchy[]>([]); // Array of classes used to build the tree view
  const [excludeInfra, setExcludeInfra] = useState(true); // Whether to exclude infrastructure files
  const [hideFramework, setHideFramework] = useState(false); // Whether to hide framework calls (not implemented yet)
  const [activeTab, setActiveTab] = useState<TabType>('hotspots');
  const [loadingClasses, setLoadingClasses] = useState(false);
  const { loadHotspotNode, searchAndAddNode, clearGraph, loading, addNode } = useGraphStore(); // Graph store actions and state

  // Load hotspot nodes
  const handleLoadHotspots = async () => {
    try {
      const results = await graphApi.getHotspots(15, {
        expanded: true,
        includeTypes: ['function', 'method']
      });
      setHotspots(results);
    } catch (error) {
      console.error('Failed to load hotspots:', error);
    }
  };

  // Load all classes
  const handleLoadClasses = async () => {
    setLoadingClasses(true);
    try {
      const results = await graphApi.getClasses();
      // Initialize them as "collapsed" objects with empty method arrays to save memory
      setClassHierarchies(results.map(c => ({ class: c, methods: [], expanded: false })));
    } catch (error) {
      console.error('Failed to load classes:', error);
    } finally {
      setLoadingClasses(false);
    }
  };

  // Toggle class expansion to show/hide methods
  const handleToggleClass = async (classId: string) => {
    // If a user expands a class for the first time, 
    // it hits the API (getMethodsOfClass) to fetch only that class's methods
    // If already loaded, it simply flips the expanded boolean
    const hierarchyIndex = classHierarchies.findIndex(h => h.class.id === classId);
    if (hierarchyIndex === -1) return;

    const hierarchy = classHierarchies[hierarchyIndex];

    if (!hierarchy.expanded && hierarchy.methods.length === 0) {
      // Fetch methods for this class
      try {
        const result = await graphApi.getMethodsOfClass(classId);
        const updatedHierarchies = [...classHierarchies];
        updatedHierarchies[hierarchyIndex] = {
          ...hierarchy,
          methods: result.expanded || [],
          expanded: true
        };
        setClassHierarchies(updatedHierarchies);
      } catch (error) {
        console.error('Failed to load methods:', error);
      }
    } else {
      // Toggle expanded state
      const updatedHierarchies = [...classHierarchies];
      updatedHierarchies[hierarchyIndex] = {
        ...hierarchy,
        expanded: !hierarchy.expanded
      };
      setClassHierarchies(updatedHierarchies);
    }
  };

  // Handle hotspot node click
  const handleHotspotClick = async (nodeId: string) => {
    await loadHotspotNode(nodeId);
  };

  // Handle class method click
  const handleNodeClick = async (node: GraphNode) => {
    // Add node to graph
    if (addNode) {
      addNode(node);
    } else {
      await loadHotspotNode(node.id);
    }
  };

  // Handle search form submission
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      await searchAndAddNode(searchQuery.trim());
      setSearchQuery('');
    }
  };

  // Filter out infrastructure files if toggle is enabled
  const filteredHotspots = excludeInfra
    ? hotspots.filter(h => {
      const fileName = h.node.meta?.file?.split('/').pop() || '';
      return !['index.ts', 'app.ts', 'server.ts', 'main.ts'].includes(fileName);
    })
    : hotspots;

  // Get node type icon
  const getNodeTypeIcon = (type: string) => {
    switch (type) {
      case 'class':
        return '📦';
      case 'method':
        return '⚡';
      case 'function':
        return 'ƒ';
      default:
        return '•';
    }
  };

  return (
    <div className="h-full bg-gray-50 border-r border-gray-200 p-4 flex flex-col">
      <h2 className="text-lg font-semibold mb-4 text-gray-800">Entry Points</h2>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-4">
        <input
          type="text"
          placeholder="Search nodes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        />
        <button
          type="submit"
          className="w-full mt-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
          disabled={loading || !searchQuery.trim()}
        >
          Search
        </button>
      </form>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-3">
        <button
          onClick={() => setActiveTab('hotspots')}
          className={`flex-1 px-2 py-2 text-xs font-medium ${activeTab === 'hotspots'
            ? 'text-blue-600 border-b-2 border-blue-600'
            : 'text-gray-500 hover:text-gray-700'
            }`}
        >
          🔥 Hotspots
        </button>
        <button
          onClick={() => setActiveTab('classes')}
          className={`flex-1 px-2 py-2 text-xs font-medium ${activeTab === 'classes'
            ? 'text-blue-600 border-b-2 border-blue-600'
            : 'text-gray-500 hover:text-gray-700'
            }`}
        >
          📦 Classes
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'hotspots' && (
          <>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-700">Hotspots</h3>
              <button
                onClick={handleLoadHotspots}
                className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
              >
                Load
              </button>
            </div>

            {/* Filter toggles */}
            <div className="space-y-1 mb-3">
              <label className="flex items-center gap-2 text-xs text-gray-600">
                <input
                  type="checkbox"
                  checked={excludeInfra}
                  onChange={(e) => setExcludeInfra(e.target.checked)}
                  className="rounded"
                />
                Hide infrastructure files
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-600">
                <input
                  type="checkbox"
                  checked={hideFramework}
                  onChange={(e) => setHideFramework(e.target.checked)}
                  className="rounded"
                />
                Hide framework calls
              </label>
            </div>

            {/* Hotspot list */}
            {filteredHotspots.length > 0 ? (
              <div className="space-y-2">
                {filteredHotspots.map((hotspot) => (
                  <button
                    key={hotspot.node.id}
                    onClick={() => handleHotspotClick(hotspot.node.id)}
                    className="w-full text-left px-3 py-2 bg-white border border-gray-200 rounded hover:bg-blue-50 hover:border-blue-300 transition-colors"
                    disabled={loading}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{getNodeTypeIcon(hotspot.node.type)}</span>
                      <span className="text-sm font-medium text-gray-900 truncate flex-1">
                        {hotspot.node.label}
                      </span>
                      {hotspot.node.type === 'method' && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">
                          method
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 truncate ml-6">
                      {hotspot.node.meta?.file?.split('/').slice(-2).join('/')}
                    </div>
                    <div className="text-xs text-gray-400 mt-1 ml-6">
                      Score: {hotspot.score} (↓{hotspot.in} ↑{hotspot.out})
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500">
                Click "Load" to see the most connected nodes
              </p>
            )}
          </>
        )}

        {activeTab === 'classes' && (
          <>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-700">Class Hierarchy</h3>
              <button
                onClick={handleLoadClasses}
                className="px-3 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700"
                disabled={loadingClasses}
              >
                {loadingClasses ? 'Loading...' : 'Load'}
              </button>
            </div>

            {/* Class list with hierarchy */}
            {classHierarchies.length > 0 ? (
              <div className="space-y-1">
                {classHierarchies.map((hierarchy) => (
                  <div key={hierarchy.class.id} className="border border-gray-200 rounded bg-white">
                    {/* Class header */}
                    <button
                      onClick={() => handleToggleClass(hierarchy.class.id)}
                      className="w-full text-left px-3 py-2 hover:bg-purple-50 transition-colors flex items-center gap-2"
                    >
                      <span className="text-gray-400 text-xs">
                        {hierarchy.expanded ? '▼' : '▶'}
                      </span>
                      <span className="text-sm">📦</span>
                      <span className="text-sm font-medium text-gray-900 truncate flex-1">
                        {hierarchy.class.label}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">
                        class
                      </span>
                    </button>

                    {/* Methods list (when expanded) */}
                    {hierarchy.expanded && (
                      <div className="border-t border-gray-100 bg-gray-50">
                        {hierarchy.methods.length > 0 ? (
                          hierarchy.methods.map((method) => (
                            <button
                              key={method.id}
                              onClick={() => handleNodeClick(method)}
                              className="w-full text-left px-3 py-1.5 pl-8 hover:bg-green-50 transition-colors flex items-center gap-2 text-xs"
                              disabled={loading}
                            >
                              <span>⚡</span>
                              <span className="text-gray-700 truncate flex-1">
                                {method.label}
                              </span>
                            </button>
                          ))
                        ) : (
                          <div className="px-3 py-2 pl-8 text-xs text-gray-400">
                            No methods found
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500">
                Click "Load" to see classes and their methods
              </p>
            )}

            {/* File path info */}
            {classHierarchies.length > 0 && (
              <div className="mt-3 text-xs text-gray-400">
                {classHierarchies.length} class{classHierarchies.length !== 1 ? 'es' : ''} found
              </div>
            )}
          </>
        )}
      </div>

      {/* Actions */}
      <div className="border-t border-gray-200 pt-4 mt-4">
        <button
          onClick={clearGraph}
          className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400"
          disabled={loading}
        >
          Clear Graph
        </button>
      </div>
    </div>
  );
}
