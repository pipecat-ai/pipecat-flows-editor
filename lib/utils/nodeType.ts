/**
 * Derives the node type from the node data based on its current state.
 * - If a node has post_actions with type "end_conversation", it's an "end" node.
 * - If a node has role_messages, it's an "initial" node.
 * - Otherwise, it's a "node".
 */
export function deriveNodeType(
  data: Record<string, unknown> | undefined,
  _originalType?: string
): string {
  if (!data) {
    return "node";
  }

  // Check for end node (has post_actions with end_conversation)
  const postActions = (data.post_actions as Array<{ type?: string }> | undefined) ?? [];
  const hasEndConversation = postActions.some((action) => action.type === "end_conversation");

  if (hasEndConversation) {
    return "end";
  }

  // Check for initial node (has role_messages)
  const roleMessages = (data.role_messages as unknown[] | undefined) ?? [];
  if (roleMessages.length > 0) {
    return "initial";
  }

  // Default to node
  return "node";
}
