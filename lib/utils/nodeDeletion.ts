import type { FlowNode } from "@/lib/types/flowTypes";

/**
 * Delete a node from the nodes array
 * Returns the updated nodes array with the specified node removed
 */
export function deleteNode(nodes: FlowNode[], nodeId: string): FlowNode[] {
  return nodes.filter((n) => n.id !== nodeId);
}

/**
 * Check if a node can be deleted (i.e., it's not a decision node)
 * Decision nodes are auto-managed by the useDecisionNodes hook
 */
export function canDeleteNode(node: FlowNode | undefined): boolean {
  if (!node) return false;
  return node.type !== "decision";
}
