import type { FlowConfigNode } from "@/lib/schema/flowConfig";

export type NodeTemplate = {
  type: "initial" | "node" | "end";
  label: string;
  node: FlowConfigNode;
};

/** Starting points for new nodes. Every node has the same shape; these differ only in defaults. */
export const NODE_TEMPLATES: NodeTemplate[] = [
  {
    type: "initial",
    label: "Initial",
    node: {
      role_message:
        "You are a helpful assistant. You must ALWAYS use the available functions to progress the conversation.",
      task_messages: [
        { role: "developer", content: "Greet the user and guide them through the conversation." },
      ],
    },
  },
  {
    type: "node",
    label: "Node",
    node: {
      task_messages: [
        {
          role: "developer",
          content:
            "You are a helpful assistant. Ask the user questions and use available functions to proceed.",
        },
      ],
    },
  },
  {
    type: "end",
    label: "End",
    node: {
      task_messages: [
        { role: "developer", content: "Thank the user and end the conversation politely." },
      ],
      post_actions: [{ type: "end_conversation" }],
    },
  },
];

export function getTemplateByType(type: string): NodeTemplate | undefined {
  return NODE_TEMPLATES.find((t) => t.type === type);
}
