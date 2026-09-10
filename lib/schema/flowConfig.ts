/**
 * Pipecat's `FlowConfig` JSON Schema, vendored and pinned.
 *
 * Source: pipecat/src/pipecat/flows/flow_config.schema.json
 *   repo:    github.com/pipecat-ai/pipecat, PR #5628 (unreleased)
 *   branch:  mb/flows-yaml-config
 *   commit:  75d9c59e5 (2026-09-09); unchanged through 36b48fb35 (2026-09-10),
 *            which the vendored examples come from
 *   version: v1.8.1-471-g75d9c59e5 (git describe)
 *
 * The schema is generated on the Pipecat side from the `FlowConfig` Pydantic
 * model by `scripts/flows/write_flow_config_schema.py` and guarded there by a
 * drift test. To update: copy the file over, bump the source record above,
 * and run `npm run gen:types` to regenerate `flowConfig.generated.ts`.
 *
 * The schema carries no `$id` yet; Pipecat adds one once it is hosted.
 */

import flowConfigSchema from "./flow_config.schema.json";

export { flowConfigSchema };

export type {
  FlowConfig,
  FlowConfigAction,
  FlowConfigBranch,
  FlowConfigFunction,
  FlowConfigMessage,
  FlowConfigNode,
} from "./flowConfig.generated";

import type {
  FlowConfig,
  FlowConfigAction,
  FlowConfigBranch,
  FlowConfigFunction,
} from "./flowConfig.generated";

/** Built-in action types whose behavior is fixed, so a `handler` is not allowed. */
export const BUILT_IN_ACTIONS_WITHOUT_HANDLER: ReadonlySet<string> = new Set([
  "tts_say",
  "end_conversation",
]);

/** Every action type the runtime provides without registration. */
export const BUILT_IN_ACTIONS: ReadonlySet<string> = new Set([
  ...BUILT_IN_ACTIONS_WITHOUT_HANDLER,
  "function",
]);

/**
 * The handler an action names, or null when it names none. An empty string
 * counts as named, since Pipecat looks it up and reports it missing rather
 * than treating the action as registered in code.
 */
export function actionHandler(action: FlowConfigAction): string | null {
  return action.handler ?? null;
}

/** Whether an action is a custom type whose handler the config does not name; it is registered in code. */
export function isRegisteredInCode(action: FlowConfigAction): boolean {
  return !BUILT_IN_ACTIONS.has(action.type) && actionHandler(action) === null;
}

/**
 * The canonical string a branch matches a case key or result value on,
 * mirroring `case_key` in `pipecat/flows/config.py`. Booleans, and strings
 * spelling one in any case, become `true` and `false`; everything else is
 * its string form. So `true:`, `"True":`, and a result of Python `True` all
 * meet at the same case.
 */
export function caseKey(value: unknown): string {
  if (typeof value === "boolean") return value ? "true" : "false";
  const text = String(value);
  const lowered = text.toLowerCase();
  return lowered === "true" || lowered === "false" ? lowered : text;
}

/** Whether a case key is written to YAML as a boolean or a number rather than a quoted string. */
export function caseKeyScalar(key: string): boolean | number | string {
  if (key === "true") return true;
  if (key === "false") return false;
  if (/^-?(0|[1-9]\d*)(\.\d+)?$/.test(key)) return Number(key);
  return key;
}

/** A config with every branch's case keys in canonical form, the last of two that meet winning. */
export function normalizeCaseKeys(config: FlowConfig): FlowConfig {
  const normalizeFunction = (fn: FlowConfigFunction): FlowConfigFunction => {
    const transition = fn.transition_to;
    if (!isBranch(transition)) return fn;
    const cases: Record<string, string> = {};
    for (const [key, target] of Object.entries(transition.cases)) cases[caseKey(key)] = target;
    return { ...fn, transition_to: { ...transition, cases } };
  };
  const nodes: FlowConfig["nodes"] = {};
  for (const [name, node] of Object.entries(config.nodes)) {
    nodes[name] = node.functions
      ? { ...node, functions: node.functions.map(normalizeFunction) }
      : node;
  }
  return {
    ...config,
    nodes,
    ...(config.global_functions
      ? { global_functions: config.global_functions.map(normalizeFunction) }
      : {}),
  };
}

/** A function's destination: a node name, a branch table, or nothing. */
export type TransitionTo = FlowConfigFunction["transition_to"];

export function isBranch(transition: TransitionTo): transition is FlowConfigBranch {
  return typeof transition === "object" && transition !== null;
}

/** Every node name a branch can transition to, cases first, then the default. */
export function branchTargets(branch: FlowConfigBranch): string[] {
  const targets = Object.values(branch.cases);
  if (branch.default) targets.push(branch.default);
  return targets;
}

/** Every node name a function can transition to. Mirrors `FlowConfig.Function.targets()`. */
export function functionTargets(fn: FlowConfigFunction): string[] {
  const transition = fn.transition_to;
  if (transition === undefined || transition === null) return [];
  if (typeof transition === "string") return [transition];
  return branchTargets(transition);
}
