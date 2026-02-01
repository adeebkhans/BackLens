/**
 * Core types matching the GraphAPI responses from core-api
 */

// Base metadata shared by most node types
export interface BaseNodeMeta {
  file?: string;
  start?: { line: number; column: number };
  end?: { line: number; column: number };
  startLine?: number;
  endLine?: number;
}

// Function-specific metadata
export interface FunctionNodeMeta extends BaseNodeMeta {
  name?: string | null;
}

// Class-specific metadata
export interface ClassNodeMeta extends BaseNodeMeta {
  name?: string;
  methods?: string[]; // List of method names in this class
}

// Method-specific metadata
export interface MethodNodeMeta extends BaseNodeMeta {
  className?: string;
  methodName?: string;
  kind?: 'method' | 'getter' | 'setter' | 'constructor';
  isStatic?: boolean;
}

// Placeholder node metadata
export interface PlaceholderNodeMeta {
  placeholderId?: string;
  calleeName?: string | null;
  file?: string;
  line?: number;
  receiver?: string | null;   // Object name for method calls
  method?: string | null;     // Method name being called
  isFramework?: boolean;
}

// External node metadata
export interface ExternalNodeMeta {
  moduleName?: string;
  isFramework?: boolean;
}

// Union type for all possible metadata shapes (using intersection for flexibility)
export type NodeMeta = BaseNodeMeta & {
  // Common
  file?: string;
  name?: string | null;
  // Function
  start?: { line: number; column: number };
  end?: { line: number; column: number };
  startLine?: number;
  endLine?: number;
  // Class
  methods?: string[];
  // Method
  className?: string;
  methodName?: string;
  kind?: string;
  isStatic?: boolean;
  // Placeholder
  placeholderId?: string;
  calleeName?: string | null;
  line?: number;
  receiver?: string | null;   // Object name for method calls
  method?: string | null;     // Method name being called
  // External
  moduleName?: string;
  // Common flags
  isFramework?: boolean;
  external?: boolean;
};

// All supported node types in the graph
export type NodeType = "function" | "file" | "class" | "method" | "external" | "placeholder";

// All supported edge types in the graph
export type EdgeType = "call" | "method_call" | "contains";

export interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  meta?: NodeMeta;
}

// Extended edge type with semantic analysis metadata
export interface GraphEdge {
  from: string;
  to: string;
  type: EdgeType;
  meta?: {
    calleeName?: string | null;
    receiver?: string | null;     // Object name for method calls
    method?: string | null;       // Method name being called
    isFramework?: boolean;        // Whether this is a framework call
    resolved?: boolean;
    external?: boolean;
    moduleName?: string | null;
  };
}

export interface QueryOptions {
  expanded?: boolean;
  includeTypes?: string[];
  excludeTypes?: string[];
  maxDepth?: number;
  tree?: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: Record<string, any>;
  message?: string;
  error?: {
    message: string;
    code: string;
  };
}

export interface CallersCalleesResponse {
  raw: string[];
  expanded: GraphNode[];
  nodes: GraphNode[]; // alias for expanded for compatibility
}

export interface HotspotNode {
  nodeId: string;
  node: GraphNode;
  in: number;
  out: number;
  score: number;
}

export interface TransitiveNode extends GraphNode {
  depth: number;
  children?: TransitiveNode[];
}

export interface PathResult {
  rawPath: string[];
  expandedPath: GraphNode[];
}

// --- Types for Object-Aware Semantic Analysis ---

// Class hierarchy node (for class tree view)
export interface ClassHierarchyNode {
  class: GraphNode;
  methods: GraphNode[];
}

// File with classes structure (for file explorer)
export interface FileClassesResponse {
  file: GraphNode;
  classes: ClassHierarchyNode[];
  functions: GraphNode[]; // standalone functions not in a class
}

// Method call with semantic metadata
export interface MethodCallInfo {
  edge: GraphEdge;
  caller: GraphNode;
  callee: GraphNode;
  receiver?: string;
  method?: string;
  isFramework: boolean;
}

// Filter options for framework calls
export interface FrameworkFilterOptions {
  hideFrameworkCalls?: boolean;
  frameworkReceivers?: string[];
}

// Extended query options with framework filtering
export interface SemanticQueryOptions extends QueryOptions {
  hideFrameworkCalls?: boolean;
  onlyMethodCalls?: boolean;
  onlyFunctionCalls?: boolean;
}

// Statistics for semantic analysis
export interface SemanticStats {
  totalNodes: number;
  totalEdges: number;
  classes: number;
  methods: number;
  functions: number;
  files: number;
  methodCalls: number;
  functionCalls: number;
  frameworkCalls: number;
}
