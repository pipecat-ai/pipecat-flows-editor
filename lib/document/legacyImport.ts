/**
 * A one-way converter for the editor's old JSON document: the format with
 * `meta`, `edges`, canvas positions, `next_node_id` routing, decisions with
 * Python snippets, and tool schemas on every function. The graph, messages,
 * actions, and plain routing convert. Two things have no home in a
 * FlowConfig and are reported by name: tool schemas, which now live in the
 * Python tools module, and decisions, which need a branch table.
 *
 * The same shape, without `meta`, is what the old editor autosaved.
 */

import type {
  FlowConfig,
  FlowConfigAction,
  FlowConfigFunction,
  FlowConfigMessage,
  FlowConfigNode,
} from "@/lib/schema/flowConfig";
import type { NodePositions } from "@/lib/storage/positionStore";

interface LegacyFunction {
  name?: string;
  description?: string;
  properties?: Record<string, unknown>;
  required?: string[];
  next_node_id?: string;
  decision?: { default_next_node_id?: string };
  cancel_on_interruption?: boolean;
  timeout_secs?: number;
}

interface LegacyNode {
  id?: string;
  type?: string;
  position?: { x?: unknown; y?: unknown };
  data?: {
    role_messages?: FlowConfigMessage[];
    task_messages?: FlowConfigMessage[];
    functions?: LegacyFunction[];
    pre_actions?: FlowConfigAction[];
    post_actions?: FlowConfigAction[];
    context_strategy?: { strategy?: string; summary_prompt?: string };
    respond_immediately?: boolean;
  };
}

interface LegacyFlow {
  meta?: unknown;
  nodes: LegacyNode[];
  global_functions?: LegacyFunction[];
}

export type LegacyDrop =
  | { kind: "tool_schema"; name: string }
  | { kind: "decision"; name: string; node: string }
  | { kind: "summary_prompt"; node: string };

export interface ConvertedLegacyFlow {
  config: FlowConfig;
  positions: NodePositions;
  dropped: LegacyDrop[];
}

/** Whether `data` is a document in the old editor format: a `nodes` array of canvas nodes. */
export function isLegacyFlowJson(data: unknown): data is LegacyFlow {
  if (typeof data !== "object" || data === null || Array.isArray(data)) return false;
  const nodes = (data as { nodes?: unknown }).nodes;
  return (
    Array.isArray(nodes) &&
    nodes.every((n) => typeof n === "object" && n !== null && typeof n.id === "string")
  );
}

export function convertLegacyFlow(legacy: LegacyFlow): ConvertedLegacyFlow {
  const dropped: LegacyDrop[] = [];
  const positions: NodePositions = {};
  const config: FlowConfig = { initial_node: "", nodes: {} };
  const nodes = legacy.nodes.filter((n) => n.type !== "decision" && n.id);

  for (const node of nodes) {
    const name = node.id!;
    const data = node.data ?? {};
    config.nodes[name] = convertNode(name, data, dropped);
    const { x, y } = node.position ?? {};
    if (typeof x === "number" && typeof y === "number") positions[name] = { x, y };
  }

  const initial =
    nodes.find((n) => n.type === "initial") ??
    nodes.find((n) => (n.data?.role_messages?.length ?? 0) > 0) ??
    nodes[0];
  config.initial_node = initial?.id ?? "";

  const globals = (legacy.global_functions ?? []).map((fn) =>
    convertFunction(fn, "global", dropped)
  );
  if (globals.length > 0) config.global_functions = globals;

  return { config, positions, dropped: dedupe(dropped) };
}

function convertNode(name: string, data: NonNullable<LegacyNode["data"]>, dropped: LegacyDrop[]) {
  const node: FlowConfigNode = { task_messages: [] };
  const roleMessages = (data.role_messages ?? []).map((m) => m.content).filter(Boolean);
  if (roleMessages.length > 0) node.role_message = roleMessages.join("\n\n");
  node.task_messages = (data.task_messages ?? []).map(({ role, content }) => ({ role, content }));
  if (data.pre_actions?.length) node.pre_actions = data.pre_actions.map(convertAction);
  if (data.functions?.length) {
    node.functions = data.functions.map((fn) => convertFunction(fn, name, dropped));
  }
  if (data.post_actions?.length) node.post_actions = data.post_actions.map(convertAction);

  const strategy = data.context_strategy?.strategy;
  if (strategy === "RESET") node.context_strategy = "reset";
  if (strategy === "RESET_WITH_SUMMARY") {
    node.context_strategy = "reset";
    dropped.push({ kind: "summary_prompt", node: name });
  }
  if (data.respond_immediately === false) node.respond_immediately = false;
  return node;
}

function convertFunction(
  fn: LegacyFunction,
  node: string,
  dropped: LegacyDrop[]
): FlowConfigFunction {
  const name = fn.name ?? "";
  const hasSchema =
    Boolean(fn.description) ||
    (fn.properties && Object.keys(fn.properties).length > 0) ||
    (fn.required && fn.required.length > 0) ||
    fn.cancel_on_interruption !== undefined ||
    fn.timeout_secs !== undefined;
  if (hasSchema && name) dropped.push({ kind: "tool_schema", name });

  if (fn.decision) {
    if (name) dropped.push({ kind: "decision", name, node });
    return { name };
  }
  return fn.next_node_id ? { name, transition_to: fn.next_node_id } : { name };
}

function convertAction(action: FlowConfigAction): FlowConfigAction {
  const converted: FlowConfigAction = { type: action.type };
  for (const [key, value] of Object.entries(action)) {
    if (key !== "type" && value !== undefined && value !== null && value !== "") {
      converted[key] = value;
    }
  }
  return converted;
}

function dedupe(drops: LegacyDrop[]): LegacyDrop[] {
  const seen = new Set<string>();
  return drops.filter((drop) => {
    const key = JSON.stringify(drop);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** A short account of what the conversion left behind, for a toast. */
export function describeLegacyDrops(dropped: LegacyDrop[]): string {
  const parts: string[] = [];
  const schemas = dropped.filter((d) => d.kind === "tool_schema").map((d) => d.name);
  const decisions = dropped.filter((d) => d.kind === "decision");
  const summaries = dropped.filter((d) => d.kind === "summary_prompt").map((d) => d.node);
  if (schemas.length > 0) {
    parts.push(`Tool schemas now belong in the tools module; dropped for ${list(schemas)}.`);
  }
  if (decisions.length > 0) {
    parts.push(
      `Decisions need a branch table; left without a destination: ${list(
        decisions.map((d) => `${d.name} on ${d.node}`)
      )}.`
    );
  }
  if (summaries.length > 0) {
    parts.push(`RESET_WITH_SUMMARY became reset; summary prompt dropped on ${list(summaries)}.`);
  }
  return parts.join(" ");
}

function list(names: string[]): string {
  return names.map((n) => `'${n}'`).join(", ");
}
