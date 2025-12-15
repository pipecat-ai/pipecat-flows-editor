import type { FlowFunctionJson } from "@/lib/schema/flow.schema";
import type { FlowNode, FlowNodeData } from "@/lib/types/flowTypes";

import { deriveNodeType } from "./nodeType";

/**
 * Update a node's data and derive its type
 */
export function updateNodeData(
  nodes: FlowNode[],
  nodeId: string,
  updates: Partial<FlowNodeData>
): FlowNode[] {
  return nodes.map((n) => {
    if (n.id === nodeId) {
      const newData = { ...n.data, ...updates };
      const derivedType = deriveNodeType(newData, n.type as string);
      return { ...n, type: derivedType as FlowNode["type"], data: newData };
    }
    return n;
  });
}

/**
 * Clear the next_node_id connection for a specific function
 * Returns updated nodes array
 */
export function clearFunctionConnection(
  nodes: FlowNode[],
  nodeId: string,
  functionIndex: number
): FlowNode[] {
  return nodes.map((node) => {
    if (node.id !== nodeId) return node;

    const nodeData = node.data as FlowNodeData;
    const functions = (nodeData?.functions || []) as FlowFunctionJson[];

    if (functionIndex < 0 || functionIndex >= functions.length) return node;

    const updatedFunctions = [...functions];
    updatedFunctions[functionIndex] = {
      ...updatedFunctions[functionIndex],
      next_node_id: undefined,
    };

    return {
      ...node,
      data: {
        ...nodeData,
        functions: updatedFunctions,
      },
    };
  });
}

/**
 * Update function references when a node ID changes
 */
export function updateFunctionReferences(
  nodes: FlowNode[],
  oldId: string,
  newId: string
): FlowNode[] {
  return nodes.map((node) => {
    const nodeData = node.data as FlowNodeData;
    const functions = (nodeData?.functions || []) as FlowFunctionJson[];
    const updatedFunctions = functions.map((func) => {
      if (func.next_node_id === oldId) {
        return { ...func, next_node_id: newId };
      }
      // Also update decision condition references
      if (func.decision) {
        const updatedConditions = func.decision.conditions.map((cond) => {
          if (cond.next_node_id === oldId) {
            return { ...cond, next_node_id: newId };
          }
          return cond;
        });
        const defaultUpdated =
          func.decision.default_next_node_id === oldId ? newId : func.decision.default_next_node_id;

        return {
          ...func,
          decision: {
            ...func.decision,
            conditions: updatedConditions,
            default_next_node_id: defaultUpdated,
          },
        };
      }
      return func;
    });

    const hasChanges = updatedFunctions.some((f, i) => f !== functions[i]);
    if (!hasChanges) return node;

    return {
      ...node,
      data: {
        ...nodeData,
        functions: updatedFunctions,
      },
    };
  });
}
