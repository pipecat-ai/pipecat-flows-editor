import type { FlowFunctionJson, MessageJson } from "@/lib/schema/flow.schema";

export type NodeTemplate = {
  type: string;
  label: string;
  data: Record<string, unknown>;
};

// Templates are just starting points - all nodes generate the same NodeConfig structure
// These provide sensible defaults for common use cases
export const NODE_TEMPLATES: NodeTemplate[] = [
  {
    type: "initial",
    label: "Initial",
    data: {
      label: "Initial",
      role_messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant. You must ALWAYS use the available functions to progress the conversation.",
        } as MessageJson,
      ],
      task_messages: [
        {
          role: "system",
          content: "Greet the user and guide them through the conversation.",
        } as MessageJson,
      ],
      functions: [] as FlowFunctionJson[],
    },
  },
  {
    type: "llm_task",
    label: "LLM Task",
    data: {
      label: "LLM Task",
      task_messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant. Ask the user questions and use available functions to proceed.",
        } as MessageJson,
      ],
      functions: [] as FlowFunctionJson[],
    },
  },
  {
    type: "end",
    label: "End",
    data: {
      label: "End",
      task_messages: [
        {
          role: "system",
          content: "Thank the user and end the conversation politely.",
        } as MessageJson,
      ],
      post_actions: [{ type: "end_conversation" }],
    },
  },
];

export function getTemplateByType(type: string): NodeTemplate | undefined {
  return NODE_TEMPLATES.find((t) => t.type === type);
}
