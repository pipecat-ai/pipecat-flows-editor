import type { CanvasNode } from "@/lib/convert/configToCanvas";

export function deleteNode(nodes: CanvasNode[], nodeId: string): CanvasNode[] {
  return nodes.filter((n) => n.id !== nodeId);
}

/**
 * Whether a node can be deleted. The initial node cannot: a flow always has
 * an entry point, so make another node initial first.
 */
export function canDeleteNode(node: CanvasNode | undefined): boolean {
  return node !== undefined && node.type !== "initial";
}
