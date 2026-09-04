import type { CanvasNode } from "@/lib/convert/configToCanvas";

export function deleteNode(nodes: CanvasNode[], nodeId: string): CanvasNode[] {
  return nodes.filter((n) => n.id !== nodeId);
}

/**
 * Whether a node can be deleted. Branch nodes cannot: they are derived from a
 * function's branch table and go away with it.
 */
export function canDeleteNode(node: CanvasNode | undefined): boolean {
  return node !== undefined && node.type !== "decision";
}
