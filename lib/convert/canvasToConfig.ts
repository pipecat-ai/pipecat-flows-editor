/**
 * The inverse of `configToCanvas`: rebuilds a `FlowConfig` from the canvas.
 * Canvas-only fields (`label`, `name`, `type`) are dropped, optional fields at
 * their defaults are omitted so the YAML stays as terse as a hand-written
 * file, and branch nodes contribute nothing since their function entries
 * already carry the branch table.
 */

import {
  type FlowConfig,
  type FlowConfigAction,
  type FlowConfigFunction,
  type FlowConfigNode,
  isBranch,
} from "@/lib/schema/flowConfig";

import { type CanvasNode, type ConfigNodeData, isConfigNode } from "./configToCanvas";

/** A function entry with `transition_to` and `default` omitted when unset. */
export function cleanFunction(fn: FlowConfigFunction): FlowConfigFunction {
  const transition = fn.transition_to;
  if (transition === undefined || transition === null) return { name: fn.name };
  if (isBranch(transition)) {
    const branch = { field: transition.field, cases: { ...transition.cases } };
    return {
      name: fn.name,
      transition_to: transition.default ? { ...branch, default: transition.default } : branch,
    };
  }
  return { name: fn.name, transition_to: transition };
}

function cleanAction(action: FlowConfigAction): FlowConfigAction {
  const { handler, ...rest } = action;
  return handler == null ? rest : { ...rest, handler };
}

/** The config node for a canvas node's data, keys in the order Pipecat's examples use. */
export function configNodeFromData(data: ConfigNodeData): FlowConfigNode {
  const node: FlowConfigNode = { task_messages: [] };
  if (data.role_message) node.role_message = data.role_message;
  node.task_messages = (data.task_messages ?? []).map((m) => ({ ...m }));
  if (data.pre_actions?.length) node.pre_actions = data.pre_actions.map(cleanAction);
  if (data.functions?.length) node.functions = data.functions.map(cleanFunction);
  if (data.post_actions?.length) node.post_actions = data.post_actions.map(cleanAction);
  if (data.context_strategy) node.context_strategy = data.context_strategy;
  if (data.respond_immediately === false) node.respond_immediately = false;
  return node;
}

/**
 * The config for the canvas. `initial_node` is the node displayed as initial;
 * when there is none it is left empty so validation reports it rather than a
 * different node silently becoming the entry point.
 */
export function canvasToConfig(
  nodes: CanvasNode[],
  globalFunctions: FlowConfigFunction[] = []
): FlowConfig {
  const configNodes = nodes.filter(isConfigNode);
  const initial = configNodes.find((node) => node.type === "initial");
  const config: FlowConfig = { initial_node: initial?.id ?? "", nodes: {} };
  for (const node of configNodes) config.nodes[node.id] = configNodeFromData(node.data);
  if (globalFunctions.length) config.global_functions = globalFunctions.map(cleanFunction);
  return config;
}
