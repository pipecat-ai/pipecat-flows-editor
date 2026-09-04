import { type CanvasNode, type ConfigCanvasNode, isConfigNode } from "@/lib/convert/configToCanvas";

import { generateNodeIdFromLabel } from "./nodeId";
import { deriveNodeType } from "./nodeType";

/**
 * A copy of a node under a new name, offset on the canvas. Destinations are
 * kept, so the copy routes where the original does. A copy of the initial
 * node is an ordinary node, since the config has one entry point.
 */
export function duplicateNode(node: ConfigCanvasNode, allNodes: CanvasNode[]): ConfigCanvasNode {
  const data = JSON.parse(JSON.stringify(node.data)) as ConfigCanvasNode["data"];
  const id = generateNodeIdFromLabel(
    `${node.id}_copy`,
    allNodes.map((n) => n.id)
  );
  const type = deriveNodeType(data, node.type === "initial" ? "node" : node.type);
  return {
    ...node,
    id,
    type,
    selected: false,
    position: { x: node.position.x + 100, y: node.position.y + 20 },
    data: { ...data, name: id, label: id, type },
  };
}

export function canDuplicateNode(node: CanvasNode | undefined): node is ConfigCanvasNode {
  return node !== undefined && isConfigNode(node);
}
