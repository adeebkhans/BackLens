/**
 * Node type registry for React Flow
 */
import type { NodeTypes } from 'reactflow';
import { CustomNode } from './GraphNode';

export const nodeTypes: NodeTypes = {
  custom: CustomNode,
};
