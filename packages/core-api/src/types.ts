export type ApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
  };
};

export type PaginationParams = {
  limit?: number;
  offset?: number;
};

export type QueryOptionsParams = {
  expanded?: boolean;
  includeTypes?: string;  // comma-separated
  excludeTypes?: string;  // comma-separated
  maxDepth?: number;
  hideExternal?: boolean | string;   // Hide external/placeholder nodes
  hideFramework?: boolean | string;  // Hide framework nodes
  edgeTypes?: string;       // comma-separated edge types (e.g., "call,method_call")
};

export type TraversalQueryParams = QueryOptionsParams & {
  tree?: boolean;  // Return tree structure instead of flat list
};

export type PathQueryParams = QueryOptionsParams & {
  start: string;
  target: string;
  depthLimit?: number;
  maxPaths?: number;
};

export type HotspotsQueryParams = QueryOptionsParams & {
  top?: number;
};