import type { CanvasNode } from "@/lib/convert/configToCanvas";

import { dropFunctionTargets } from "./nodeUpdates";

/** Removes a node and every destination on the other nodes that pointed at it. */
export function deleteNode(nodes: CanvasNode[], nodeId: string): CanvasNode[] {
  return nodes
    .filter((n) => n.id !== nodeId)
    .map((n) => ({
      ...n,
      data: { ...n.data, functions: dropFunctionTargets(n.data.functions ?? [], nodeId) },
    }));
}

/**
 * Whether a node can be deleted. The initial node cannot: a flow always has
 * an entry point, so make another node initial first.
 */
export function canDeleteNode(node: CanvasNode | undefined): boolean {
  return node !== undefined && node.type !== "initial";
}
