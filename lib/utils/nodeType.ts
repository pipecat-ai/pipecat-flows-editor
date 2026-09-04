import type { ConfigNodeType } from "@/lib/convert/configToCanvas";
import type { FlowConfigNode } from "@/lib/schema/flowConfig";

/**
 * The display type of a canvas node after its data changes. The initial node
 * is whichever node the config's `initial_node` names, so that type sticks;
 * otherwise an `end_conversation` post-action makes an end node.
 */
export function deriveNodeType(
  data: Partial<FlowConfigNode> | undefined,
  currentType: string | undefined
): ConfigNodeType {
  if (currentType === "initial") return "initial";
  const postActions = data?.post_actions ?? [];
  if (postActions.some((action) => action.type === "end_conversation")) return "end";
  return "node";
}
