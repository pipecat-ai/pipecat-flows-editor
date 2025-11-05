import type { Node } from "reactflow";

import { deriveNodeType } from "./nodeType";

/**
 * Update a node's data and derive its type
 */
export function updateNodeData(
  nodes: Node[],
  nodeId: string,
  updates: Partial<Record<string, unknown>>
): Node[] {
  return nodes.map((n) => {
    if (n.id === nodeId) {
      const newData = { ...n.data, ...updates };
      const derivedType = deriveNodeType(newData, n.type as string);
      return { ...n, type: derivedType, data: newData };
    }
    return n;
  });
}

/**
 * Update function references when a node ID changes
 */
export function updateFunctionReferences(nodes: Node[], oldId: string, newId: string): Node[] {
  return nodes.map((node) => {
    const nodeData = node.data as any;
    const functions = (nodeData?.functions || []) as any[];
    const updatedFunctions = functions.map((func: any) => {
      if (func.next_node_id === oldId) {
        return { ...func, next_node_id: newId };
      }
      // Also update decision condition references
      if (func.decision) {
        const updatedConditions = func.decision.conditions.map((cond: any) => {
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
