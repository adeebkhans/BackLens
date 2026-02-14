/**
 * Custom node component for React Flow
 * Enhanced with Object-Aware Semantic Analysis visualization
 */
import { memo, useState } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import type { GraphNode, MethodNodeMeta, ClassNodeMeta } from '../../types/graph';
import { isVsCodeEnvironment } from '../../api/createProvider';

type CustomNodeData = {
  node: GraphNode;
  onExpandCallers: () => void;
  onExpandCallees: () => void;
  onDelete: () => void;
};

// Icons for different node types (returns svgs)
const NodeTypeIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'class':
      return (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 6a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2zm0 6a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2z" clipRule="evenodd" />
        </svg>
      );
    case 'method':
      return (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      );
    case 'function':
      return (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633z" clipRule="evenodd" />
        </svg>
      );
    case 'file':
      return (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
        </svg>
      );
    case 'external':
      return (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4.083 9h1.946c.089-1.546.383-2.97.837-4.118A6.004 6.004 0 004.083 9zM10 2a8 8 0 100 16 8 8 0 000-16zm0 2c-.076 0-.232.032-.465.262-.238.234-.497.623-.737 1.182-.389.907-.673 2.142-.766 3.556h3.936c-.093-1.414-.377-2.649-.766-3.556-.24-.56-.5-.948-.737-1.182C10.232 4.032 10.076 4 10 4z" clipRule="evenodd" />
        </svg>
      );
    default:
      return (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
        </svg>
      );
  }
};

// Badge component for method ownership and framework indicators
const Badge = ({ text, color }: { text: string; color: 'purple' | 'orange' | 'blue' | 'green' }) => {
  const colorClasses = {
    purple: 'bg-purple-100 text-purple-700 border-purple-200',
    orange: 'bg-orange-100 text-orange-700 border-orange-200',
    blue: 'bg-blue-100 text-blue-700 border-blue-200',
    green: 'bg-green-100 text-green-700 border-green-200',
  };

  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded border ${colorClasses[color]}`}>
      {text}
    </span>
  );
};

export const CustomNode = memo(({ data, selected }: NodeProps<CustomNodeData>) => {
  const { node, onExpandCallers, onExpandCallees } = data;
  const meta = node.meta;   
  const [hovered, setHovered] = useState(false);

  // Color based on node type
  const getNodeColor = () => {
    switch (node.type) {
      case 'function':
        return 'bg-blue-50 border-blue-300 hover:border-blue-400';
      case 'file':
        return 'bg-gray-50 border-gray-300 hover:border-gray-400';
      case 'class':
        return 'bg-purple-50 border-purple-400 hover:border-purple-500';
      case 'method':
        return 'bg-green-50 border-green-400 hover:border-green-500';
      case 'external':
        return 'bg-orange-50 border-orange-300 hover:border-orange-400';
      case 'placeholder':
        // Use yellow/amber for unresolved calls, orange tint if framework
        return isFrameworkRelated()
          ? 'bg-orange-50 border-orange-300 hover:border-orange-400'
          : 'bg-yellow-50 border-yellow-300 hover:border-yellow-400';
      default:
        return 'bg-gray-50 border-gray-300 hover:border-gray-400';
    }
  };

  // Get header background color for class indicator
  const getHeaderColor = () => {
    switch (node.type) {
      case 'class':
        return 'bg-purple-100';
      case 'method':
        return 'bg-green-100';
      case 'function':
        return 'bg-blue-100';
      case 'external':
        return 'bg-orange-100';
      case 'placeholder':
        return isFrameworkRelated() ? 'bg-orange-100' : 'bg-yellow-100';
      default:
        return 'bg-gray-100';
    }
  };

  // Extract class name for methods
  const getClassName = (): string | undefined => {
    if (node.type === 'method' && meta) {
      return (meta as MethodNodeMeta).className;
    }
    return undefined;
  };

  // Get method count for classes
  const getMethodCount = (): number | undefined => {
    if (node.type === 'class' && meta) {
      return (meta as ClassNodeMeta).methods?.length;
    }
    return undefined;
  };

  // Check if this is a framework-related call
  const isFrameworkRelated = (): boolean => {
    if (meta && 'isFramework' in meta) {
      return meta.isFramework === true;
    }
    return false;
  };

  const className = getClassName();
  const methodCount = getMethodCount();
  const isFramework = isFrameworkRelated();

  return (
    <div
      className={`
        rounded-lg border-2 shadow-md min-w-[200px] max-w-[300px] overflow-hidden transition-all
        ${getNodeColor()}
        ${isVsCodeEnvironment() ? 'cursor-pointer' : ''}
      `}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={isVsCodeEnvironment() ? 'Double-click to navigate to source' : ''}
    >
      {/* Input/Output handles (a Handle is a connection point (a port) where edges/lines attach to a node) */}
      {/* positioned on all sides for flexible edge routing */}
      <Handle type="target" position={Position.Left} id="left" className="!bg-blue-400" />
      <Handle type="target" position={Position.Top} id="top" className="!bg-gray-400" />
      <Handle type="source" position={Position.Right} id="right" className="!bg-green-400" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="!bg-gray-400" />

      {/* Node header with icon */}
      <div className={`px-3 py-2 ${getHeaderColor()} border-b border-opacity-50`}>
        <div className="flex items-center gap-2">
          <span className="text-gray-600">
            <NodeTypeIcon type={node.type} />
          </span>
          <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
            {/* Show friendlier names for placeholder nodes */}
            {node.type === 'placeholder'
              ? (meta?.external ? 'External Method' : isFramework ? 'Framework' : (meta?.receiver ? 'Method Call' : 'External'))
              : node.type}
          </span>
          {(isFramework || (node.type === 'placeholder' && meta?.external)) && (
            <Badge text={isFramework ? "Framework" : "External"} color={isFramework ? "orange" : "orange"} />
          )}
          <button // Delete button, only visible on hover or selection
            onClick={(e) => {
              e.stopPropagation(); // prevent triggering node selection (bubble up)
              data.onDelete();
            }}
            className={`ml-auto text-gray-500 hover:text-gray-700 text-sm transition-opacity ${selected || hovered ? 'opacity-100' : 'opacity-0'}`}
            title="Delete node from view"
            aria-label="Delete node"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M10 11v6M14 11v6M9 7l1-2h4l1 2m-7 0h8l-1 13H10L9 7z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Node content */}
      <div className="px-3 py-2">
        {/* Label */}
        <div className="font-semibold text-gray-900 text-sm break-words mb-1">
          {node.type === 'method' ? `${node.label}()` : node.label}
        </div>

        {/* Method ownership badge */}
        {className && (
          <div className="mb-1">
            <Badge text={`⤷ ${className}`} color="purple" />
          </div>
        )}

        {/* Class method count */}
        {methodCount !== undefined && (
          <div className="text-xs text-gray-600 mb-1">
            {methodCount} method{methodCount !== 1 ? 's' : ''}
          </div>
        )}

        {/* File path (if available) */}
        {meta?.file && (
          <div className="text-xs text-gray-500 truncate" title={meta.file}>
            📁 {meta.file.split('/').slice(-2).join('/')}
          </div>
        )}

        {/* Module name for external nodes and external method calls */}
        {node.type === 'external' && meta?.moduleName && (
          <div className="text-xs text-orange-600 font-medium">
            📦 {meta.moduleName}
          </div>
        )}

        {/* Module name for external method placeholders */}
        {node.type === 'placeholder' && meta?.external && meta?.moduleName && (
          <div className="text-xs text-orange-600 font-medium">
            📦 from {meta.moduleName}
          </div>
        )}

        {/* Line info for methods/functions */}
        {meta && 'startLine' in meta && meta.startLine && (
          <div className="text-xs text-gray-400 mt-0.5">
            Line {meta.startLine}{meta.endLine ? `-${meta.endLine}` : ''}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-1 px-3 pb-3">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onExpandCallers();
          }}
          className="flex-1 px-2 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 font-medium transition-colors flex items-center justify-center gap-1"
          title="Expand Callers"
        >
          <span>←</span> Callers
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onExpandCallees();
          }}
          className="flex-1 px-2 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 font-medium transition-colors flex items-center justify-center gap-1"
          title="Expand Callees"
        >
          Callees <span>→</span>
        </button>
      </div>
    </div>
  );
});

CustomNode.displayName = 'CustomNode';