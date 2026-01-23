// Exported type defining all possible node categories in the graph
export type NodeType = "function" | "file" | "external" | "placeholder" | "class" | "method";

// --- Base Node Structure ---

// The fundamental properties shared by all node types
export type BaseNode = {
  id: string;        // The unique, stable identifier for the node
  type: NodeType;    // Specifies the specific category of the node 
  label?: string;    // Human-friendly display text (e.g., the function's name or file's basename)
  meta?: Record<string, any>; // Container for additional, type-specific data
};

// --- Specific Node Implementations ---

// Represents a function definition 
export type FunctionNode = BaseNode & {
  type: "function";
  meta: {
    file: string;    // The file path where the function is defined
    name: string | null; // The identifier name of the function
    start: { line: number; column: number }; // Start location for linking back to source code
    end: { line: number; column: number };   // End location
  };
};

// Represents a source file (used for hierarchical organization)
export type FileNode = BaseNode & {
  type: "file";
  meta: {
    path: string; // The normalized full path of the source file
  };
};

// Represents an external package dependency (e.g., 'express', 'lodash')
export type ExternalNode = BaseNode & {
  type: "external";
  meta: {
    moduleName: string; // The name of the package
  };
};

// Represents a call site that could NOT be resolved to a FunctionNode or ExternalNode
export type PlaceholderNode = BaseNode & {
  type: "placeholder";
  meta: {
    placeholderId: string; // The original temporary ID from the parser IR
    calleeName: string | null; // The name that was attempted to be resolved
    file: string;
    line?: number;
  };
};

// Represents a class definition 
export type ClassNode = BaseNode & {
  type: "class";
  meta: {
    file: string;    // The file path where the class is defined
    name: string;    // The class name identifier
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
};

// Represents a method definition within a class
export type MethodNode = BaseNode & {
  type: "method";
  meta: {
    file: string;    // The file path where the method is defined
    className: string; // The class this method belongs to
    methodName: string; // The method name identifier
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
};

// Union type covering all possible node types in the final graph
export type GraphNode = FunctionNode | FileNode | ExternalNode | PlaceholderNode | ClassNode | MethodNode;

// --- Edge (Relationship) Structure ---

// Exported type defining all possible edge categories
export type EdgeType = "call" | "contains" | "method_call";

// Defines the structure for a relationship between two nodes
export type GraphEdge = {
  from: string; // The ID of the source node (caller, container file, etc.)
  to: string;   // The ID of the target node (callee, contained function, etc.)
  type: EdgeType; // The type of relationship (e.g., "call" for function-to-function)
  meta?: Record<string, any>; // Additional data, like the line number of the call
};

// --- Final Graph Container ---

// The complete structure representing the entire project analysis result
export type Graph = {
  nodes: GraphNode[]; // Array of all entities in the graph
  edges: GraphEdge[]; // Array of all relationships in the graph
  sourceRoot?: string; // Absolute path to the project root (for rehydrating relative paths to absolute paths)
};