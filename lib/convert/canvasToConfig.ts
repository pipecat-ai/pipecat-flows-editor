/**
 * The inverse of `configToCanvas`: rebuilds a `FlowConfig` from the canvas.
 * Canvas-only fields (`label`, `name`, `type`) are dropped. Every config key
 * present on a node's data is emitted, even at its default, so a key an
 * author wrote survives the round trip; keys the editor never set stay out.
 */

import {
  type FlowConfig,
  type FlowConfigAction,
  type FlowConfigBranch,
  type FlowConfigFunction,
  type FlowConfigNode,
  isBranch,
} from "@/lib/schema/flowConfig";

import type { CanvasNode, ConfigNodeData } from "./configToCanvas";

/**
 * A function entry as the config carries it, keys in Pipecat's order. An
 * unset `transition_to` or `default` is left out; `transition_only` and its
 * `description` are written only when the flag is on.
 */
export function cleanFunction(fn: FlowConfigFunction): FlowConfigFunction {
  const clean: FlowConfigFunction = { name: fn.name };
  if (fn.transition_only) {
    clean.transition_only = true;
    if (fn.description !== undefined) clean.description = fn.description;
  }
  const transition = fn.transition_to;
  if (transition === undefined) return clean;
  if (transition === null) {
    clean.transition_to = null; // written in the file; kept as written
    return clean;
  }
  if (isBranch(transition)) {
    const branch: FlowConfigBranch = { field: transition.field, cases: { ...transition.cases } };
    if (transition.default !== undefined) branch.default = transition.default;
    clean.transition_to = branch;
  } else {
    clean.transition_to = transition;
  }
  return clean;
}

function cleanAction(action: FlowConfigAction): FlowConfigAction {
  const { handler, ...rest } = action;
  return handler === undefined ? rest : { ...rest, handler };
}

/**
 * The config node for a canvas node's data, keys in the order Pipecat's
 * examples use. A key is written when the data has it, whatever its value,
 * so an explicit `respond_immediately: true` or `functions: []` in a file is
 * not dropped; the inspector removes a key by setting it to undefined.
 */
export function configNodeFromData(data: ConfigNodeData): FlowConfigNode {
  const node: FlowConfigNode = { task_messages: [] };
  if (data.role_message !== undefined) node.role_message = data.role_message;
  node.task_messages = (data.task_messages ?? []).map((m) => ({ ...m }));
  if (data.pre_actions !== undefined) node.pre_actions = data.pre_actions.map(cleanAction);
  if (data.functions !== undefined) node.functions = data.functions.map(cleanFunction);
  if (data.post_actions !== undefined) node.post_actions = data.post_actions.map(cleanAction);
  if (data.context_strategy !== undefined) node.context_strategy = data.context_strategy;
  if (data.respond_immediately !== undefined) node.respond_immediately = data.respond_immediately;
  return node;
}

/**
 * The config for the canvas. `initial_node` is the node displayed as initial.
 * When no node is, `fallbackInitialNode` is written instead: the name the
 * opened file had, so a typo stays visible and reported rather than a
 * different node silently becoming the entry point.
 */
export function canvasToConfig(
  nodes: CanvasNode[],
  globalFunctions: FlowConfigFunction[] = [],
  fallbackInitialNode = ""
): FlowConfig {
  const initial = nodes.find((node) => node.type === "initial");
  const config: FlowConfig = { initial_node: initial?.id ?? fallbackInitialNode, nodes: {} };
  for (const node of nodes) config.nodes[node.id] = configNodeFromData(node.data);
  if (globalFunctions.length) config.global_functions = globalFunctions.map(cleanFunction);
  return config;
}
