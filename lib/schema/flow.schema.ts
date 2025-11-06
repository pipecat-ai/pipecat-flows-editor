import { type Static, Type } from "@sinclair/typebox";

// Node types are just templates - all nodes generate the same NodeConfig structure
// These provide sensible defaults for common use cases
export const NodeType = Type.Union([
  Type.Literal("initial"), // Entry point with role_messages and task_messages
  Type.Literal("node"), // Interactive node with task_messages and functions
  Type.Literal("end"), // End node with post_actions: end_conversation
]);

export const Position = Type.Object({ x: Type.Number(), y: Type.Number() });

// Message object (role + content) for Pipecat NodeConfig
export const Message = Type.Object({
  role: Type.Union([Type.Literal("system"), Type.Literal("user"), Type.Literal("assistant")]),
  content: Type.String(),
});

// Function property schema (JSON Schema format)
export const FunctionProperty = Type.Object({
  type: Type.String(),
  description: Type.Optional(Type.String()),
  enum: Type.Optional(Type.Array(Type.Union([Type.String(), Type.Number()]))),
  minimum: Type.Optional(Type.Number()),
  maximum: Type.Optional(Type.Number()),
  pattern: Type.Optional(Type.String()), // Regex pattern for string validation
});

// Decision condition structure
export const DecisionCondition = Type.Object({
  operator: Type.Union([
    Type.Literal("<"),
    Type.Literal("<="),
    Type.Literal("=="),
    Type.Literal(">="),
    Type.Literal(">"),
    Type.Literal("!="),
    Type.Literal("not"),
    Type.Literal("in"),
    Type.Literal("not in"),
  ]),
  value: Type.String(), // Value to compare against
  next_node_id: Type.String({ minLength: 1 }), // Next node ID for this condition
});

// Decision structure for conditional routing
export const Decision = Type.Object({
  action: Type.String({ minLength: 1 }), // Python code block that must set the 'result' variable
  conditions: Type.Array(DecisionCondition), // Array of condition+next_node pairs
  default_next_node_id: Type.String({ minLength: 1 }), // Default next node (always required)
  decision_node_position: Type.Optional(Type.Object({ x: Type.Number(), y: Type.Number() })), // Optional position for the decision node visualization
});

// FlowsFunctionSchema structure
export const FlowFunction = Type.Object({
  name: Type.String({ minLength: 1 }),
  description: Type.String(),
  properties: Type.Optional(Type.Record(Type.String(), FunctionProperty)),
  required: Type.Optional(Type.Array(Type.String())),
  next_node_id: Type.Optional(Type.String()), // Next node ID this function routes to (or default when decision exists)
  decision: Type.Optional(Decision), // Optional decision for conditional routing
});

// Pre/Post action structure
export const Action = Type.Object({
  type: Type.String(), // e.g., "function", "end_conversation", "tts_say"
  handler: Type.Optional(Type.String()), // Handler function name/reference (for "function" type)
  text: Type.Optional(Type.String()), // Text to say (for "tts_say" type)
});

// Context Strategy configuration
export const ContextStrategyConfig = Type.Object({
  strategy: Type.Union([
    Type.Literal("APPEND"),
    Type.Literal("RESET"),
    Type.Literal("RESET_WITH_SUMMARY"),
  ]),
  summary_prompt: Type.Optional(Type.String()), // Only relevant for RESET_WITH_SUMMARY
});

// Common node data structure matching Pipecat NodeConfig
export const CommonNodeData = Type.Object({
  label: Type.Optional(Type.String({ minLength: 1 })),
  // Pipecat NodeConfig fields
  role_messages: Type.Optional(Type.Array(Message)), // Bot role/personality messages
  task_messages: Type.Optional(Type.Array(Message)), // Task/instruction messages
  functions: Type.Optional(Type.Array(FlowFunction)), // Available functions
  pre_actions: Type.Optional(Type.Array(Action)), // Pre-execution actions
  post_actions: Type.Optional(Type.Array(Action)), // Post-execution actions
  context_strategy: Type.Optional(ContextStrategyConfig), // Context strategy configuration
  respond_immediately: Type.Optional(Type.Boolean()), // Whether LLM responds immediately (default: true)
});

export const FlowNode = Type.Object({
  id: Type.String({ minLength: 1 }),
  type: NodeType,
  position: Position,
  data: Type.Intersect([CommonNodeData, Type.Record(Type.String(), Type.Any())]), // Common + per-type data
});

export const EdgeCondition = Type.Object({
  expression: Type.Optional(Type.String()),
  language: Type.Optional(
    Type.Union([Type.Literal("python"), Type.Literal("jinja"), Type.Literal("dsl")])
  ),
});

export const FlowEdge = Type.Object({
  id: Type.String({ minLength: 1 }),
  source: Type.String({ minLength: 1 }),
  target: Type.String({ minLength: 1 }),
  label: Type.Optional(Type.String()),
  priority: Type.Optional(Type.Integer({ minimum: 0 })),
  condition: Type.Optional(EdgeCondition),
});

export const FlowMeta = Type.Object({
  name: Type.String({ minLength: 1 }),
  version: Type.String({ default: "0.1.0" }),
  description: Type.Optional(Type.String()),
});

// Global functions available at every node
export const GlobalFunction = Type.Object({
  name: Type.String({ minLength: 1 }),
  description: Type.String(),
  properties: Type.Optional(Type.Record(Type.String(), FunctionProperty)),
  required: Type.Optional(Type.Array(Type.String())),
});

export const FlowSchema = Type.Object({
  $schema: Type.Optional(Type.String()),
  $id: Type.Optional(Type.String()),
  meta: FlowMeta,
  context: Type.Optional(Type.Record(Type.String(), Type.Any())),
  global_functions: Type.Optional(Type.Array(GlobalFunction)), // Functions available at all nodes
  nodes: Type.Array(FlowNode, { minItems: 1 }),
  edges: Type.Array(FlowEdge), // Edges for visualization; routing primarily via function.next_node_id
});

export type FlowJson = Static<typeof FlowSchema>;
export type FlowNodeJson = Static<typeof FlowNode>;
export type FlowEdgeJson = Static<typeof FlowEdge>;
export type FlowFunctionJson = Static<typeof FlowFunction>;
export type MessageJson = Static<typeof Message>;
export type ActionJson = Static<typeof Action>;
export type DecisionJson = Static<typeof Decision>;
export type DecisionConditionJson = Static<typeof DecisionCondition>;
export type ContextStrategyConfigJson = Static<typeof ContextStrategyConfig>;
export type GlobalFunctionJson = Static<typeof GlobalFunction>;

export const FLOW_SCHEMA_ID = "https://flows.pipecat.ai/schema/flow.json";

export function getCompiledJsonSchema() {
  // Attach $id for downstream validators and exporters
  return { $id: FLOW_SCHEMA_ID, ...FlowSchema } as const;
}
