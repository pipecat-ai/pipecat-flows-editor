import type { Node } from "reactflow";

import type { FlowFunctionJson } from "@/lib/schema/flow.schema";

/**
 * Parse decision node ID to extract source node ID and function name
 * Format: decision-${sourceNodeId}-${functionName}
 */
export function parseDecisionNodeId(decisionNodeId: string): {
  sourceNodeId: string;
  functionName: string;
} | null {
  const match = decisionNodeId.match(/^decision-(.+?)-(.+)$/);
  if (!match) return null;
  return { sourceNodeId: match[1], functionName: match[2] };
}

/**
 * Generate decision node ID from source node ID and function name
 */
export function generateDecisionNodeId(sourceNodeId: string, functionName: string): string {
  return `decision-${sourceNodeId}-${functionName}`;
}

/**
 * Find the source node and function for a decision node
 */
export function findDecisionSource(
  decisionNodeId: string,
  nodes: Node[]
): { sourceNode: Node; functionIndex: number; function: FlowFunctionJson } | null {
  const parsed = parseDecisionNodeId(decisionNodeId);
  if (!parsed) return null;

  const sourceNode = nodes.find((n) => n.id === parsed.sourceNodeId);
  if (!sourceNode) return null;

  const functions = ((sourceNode.data as any)?.functions as FlowFunctionJson[] | undefined) ?? [];
  const functionIndex = functions.findIndex(
    (f) => f.name === parsed.functionName && f.decision !== undefined
  );

  if (functionIndex < 0) return null;

  return {
    sourceNode,
    functionIndex,
    function: functions[functionIndex],
  };
}

/**
 * Get decision node data for a function
 */
export function getDecisionNodeData(
  sourceNodeId: string,
  sourceNodePosition: { x: number; y: number },
  func: FlowFunctionJson
): {
  id: string;
  position: { x: number; y: number };
  data: {
    label: string;
    action: string;
    conditionCount: number;
    sourceNodeId: string;
    functionName: string;
  };
} {
  const decisionNodeId = generateDecisionNodeId(sourceNodeId, func.name);
  const savedPosition = func.decision?.decision_node_position;
  const position = savedPosition
    ? { x: savedPosition.x, y: savedPosition.y }
    : { x: sourceNodePosition.x, y: sourceNodePosition.y + 150 };

  return {
    id: decisionNodeId,
    position,
    data: {
      label: func.name,
      action: func.decision!.action,
      conditionCount: func.decision!.conditions.length,
      sourceNodeId,
      functionName: func.name,
    },
  };
}
