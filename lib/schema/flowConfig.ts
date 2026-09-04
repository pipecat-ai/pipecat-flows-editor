/**
 * Pipecat's `FlowConfig` JSON Schema, vendored and pinned.
 *
 * Source: pipecat/src/pipecat/flows/flow_config.schema.json
 *   repo:    github.com/pipecat-ai/pipecat, PR #5628 (unreleased)
 *   branch:  mb/flows-yaml-config
 *   commit:  35a4ef5d4039d4bb0b6910b3009a07b9e11cf751 (2026-09-03)
 *   version: v1.8.1-275-g35a4ef5d4 (git describe)
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

import type { FlowConfigBranch, FlowConfigFunction } from "./flowConfig.generated";

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
