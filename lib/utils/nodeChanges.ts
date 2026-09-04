import type { NodeChange } from "@xyflow/react";

import type { CanvasNode } from "@/lib/convert/configToCanvas";
import { canDeleteNode } from "@/lib/utils/nodeDeletion";

/**
 * React Flow's own Delete and Backspace handling removes selected nodes
 * through the change stream, bypassing the editor's rules. This drops the
 * removals the editor would refuse: the initial node, which a flow always
 * needs, and branch nodes, which are derived from their function.
 */
export function filterNodeChanges(
  changes: NodeChange<CanvasNode>[],
  nodes: CanvasNode[]
): NodeChange<CanvasNode>[] {
  return changes.filter(
    (change) => change.type !== "remove" || canDeleteNode(nodes.find((n) => n.id === change.id))
  );
}
