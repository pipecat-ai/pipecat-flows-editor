/**
 * Validates a `FlowConfig` document the way Pipecat does: structurally against
 * the shipped JSON Schema, then by the cross-reference checks JSON Schema
 * cannot express, then by the graph warnings a valid config can still
 * deserve. The checks mirror `pipecat/flows/config.py` and
 * `pipecat/flows/validation.py` so both sides report the same documents the
 * same way, in the same words. Tools are not checked here; the referenced
 * tools list is the handoff to code.
 */

import Ajv2020, { type ErrorObject } from "ajv/dist/2020";

import {
  actionHandlers,
  referencedTools,
  templateVariables,
} from "@/lib/document/flowIntrospection";
import {
  type FlowConfig,
  type FlowConfigAction,
  type FlowConfigFunction,
  flowConfigSchema,
  functionTargets,
  isBranch,
} from "@/lib/schema/flowConfig";

import type { FlowReport, LocatedIssue } from "./flowIssues";

const ajv = new Ajv2020({ allErrors: true, allowUnionTypes: true });
const validateSchema = ajv.compile<FlowConfig>(flowConfigSchema);

export type FlowConfigValidation =
  | { valid: true; config: FlowConfig; issues: [] }
  | { valid: false; config: null; issues: LocatedIssue[] };

/** Schema validation only. On success the input is typed as a `FlowConfig`. */
export function validateFlowConfigSchema(data: unknown): FlowConfigValidation {
  if (validateSchema(data)) return { valid: true, config: data, issues: [] };
  return { valid: false, config: null, issues: (validateSchema.errors ?? []).map(schemaIssue) };
}

/**
 * The full report: schema and reference errors, and the graph warnings once
 * the config loads cleanly, with the tools and variables it refers to.
 */
export function validateFlow(data: unknown): FlowReport & { config: FlowConfig | null } {
  const structural = validateFlowConfigSchema(data);
  if (!structural.valid) {
    return { ok: false, issues: structural.issues, tools: [], variables: [], config: null };
  }
  const config = structural.config;
  const references = checkFlowConfigReferences(config);
  const issues = references.length > 0 ? references : checkFlowGraph(config);
  return {
    ok: references.length === 0,
    issues,
    tools: [
      ...new Set([...referencedTools(config), ...actionHandlers(config)].map((r) => r.name)),
    ].sort(),
    variables: templateVariables(config).map((v) => v.name),
    config,
  };
}

/**
 * The rules from `FlowConfig._check_graph`, `Node._check_unique_function_names`,
 * and `Action._check_handler`, in that module's order and wording. Messages
 * carry the location prefix Pydantic would give them: none for the root
 * validator, `nodes.<name>` for a node's, and the action's path for an action's.
 *
 * - `initial_node` names a defined node.
 * - Function names are unique in `global_functions` and within each node.
 * - A node's function does not share a name with a global function.
 * - Every destination, including branch cases and defaults, names a node.
 * - A `function` action has a `handler`; no other action type does.
 */
export function checkFlowConfigReferences(config: FlowConfig): LocatedIssue[] {
  const issues: LocatedIssue[] = [];
  const nodeNames = new Set(Object.keys(config.nodes));
  const globalFunctions = config.global_functions ?? [];

  if (!nodeNames.has(config.initial_node)) {
    issues.push({
      level: "error",
      code: "schema",
      message: `initial_node '${config.initial_node}' is not a defined node`,
      instancePath: "/initial_node",
    });
  }

  checkUnique(globalFunctions, "/global_functions", "", "global_functions", issues);
  const globalNames = new Set(globalFunctions.map((fn) => fn.name));

  for (const [nodeName, node] of Object.entries(config.nodes)) {
    const path = `/nodes/${escapePointer(nodeName)}`;
    const functions = node.functions ?? [];

    checkUnique(functions, `${path}/functions`, `nodes.${nodeName}: `, "node", issues, nodeName);

    functions.forEach((fn, i) => {
      if (globalNames.has(fn.name)) {
        issues.push({
          level: "error",
          code: "schema",
          message: `node '${nodeName}' function '${fn.name}' is also a global function`,
          node: nodeName,
          function: fn.name,
          instancePath: `${path}/functions/${i}/name`,
        });
      }
    });
    functions.forEach((fn, i) => {
      checkTargets(fn, `${path}/functions/${i}`, `node '${nodeName}'`, nodeName, nodeNames, issues);
    });

    (node.pre_actions ?? []).forEach((action, i) => {
      checkAction(
        action,
        `${path}/pre_actions/${i}`,
        `nodes.${nodeName}.pre_actions.${i}`,
        nodeName,
        issues
      );
    });
    (node.post_actions ?? []).forEach((action, i) => {
      checkAction(
        action,
        `${path}/post_actions/${i}`,
        `nodes.${nodeName}.post_actions.${i}`,
        nodeName,
        issues
      );
    });
  }

  globalFunctions.forEach((fn, i) => {
    checkTargets(fn, `/global_functions/${i}`, "global_functions", undefined, nodeNames, issues);
  });

  return issues;
}

/**
 * The graph warnings from `pipecat/flows/validation.py`'s `_check_graph`, for
 * a config that loads cleanly: nodes the flow can never reach, nodes it can
 * never leave, and branches whose cases and default all go one place. Global
 * functions count as exits from every node; a self-loop does not count as
 * leaving; a branch without a default has "stay on the node" as an outcome.
 */
export function checkFlowGraph(config: FlowConfig): LocatedIssue[] {
  const issues: LocatedIssue[] = [];
  const globalTargets = new Set((config.global_functions ?? []).flatMap(functionTargets));

  const exits = (name: string): Set<string> => {
    const targets = new Set(globalTargets);
    for (const fn of config.nodes[name]?.functions ?? []) {
      for (const target of functionTargets(fn)) targets.add(target);
    }
    return targets;
  };

  const reachable = new Set([config.initial_node]);
  const frontier = [config.initial_node];
  while (frontier.length > 0) {
    for (const target of exits(frontier.pop()!)) {
      if (!reachable.has(target)) {
        reachable.add(target);
        frontier.push(target);
      }
    }
  }
  for (const name of Object.keys(config.nodes)) {
    if (!reachable.has(name)) {
      issues.push({
        level: "warning",
        code: "unreachable_node",
        message: `node '${name}' cannot be reached from '${config.initial_node}'`,
        node: name,
        instancePath: `/nodes/${escapePointer(name)}`,
      });
    }
  }

  for (const [name, node] of Object.entries(config.nodes)) {
    const ends = (node.post_actions ?? []).some((a) => a.type === "end_conversation");
    const leaves = [...exits(name)].some((target) => target !== name);
    if (!ends && !leaves) {
      issues.push({
        level: "warning",
        code: "dead_end",
        message: `node '${name}' has no function that leaves it and does not end the conversation`,
        node: name,
        instancePath: `/nodes/${escapePointer(name)}`,
      });
    }
  }

  for (const [name, node] of Object.entries(config.nodes)) {
    (node.functions ?? []).forEach((fn, i) => {
      const branch = fn.transition_to;
      if (!isBranch(branch)) return;
      // Without a default, an unmatched value stays on the node, so the
      // branch has two outcomes even when every case names one node.
      if (!branch.default) return;
      const targets = new Set(functionTargets(fn));
      if (targets.size === 1) {
        const [only] = targets;
        issues.push({
          level: "warning",
          code: "branch_single_target",
          message: `node '${name}' function '${fn.name}' branches on '${branch.field}' but every case and the default lead to '${only}'`,
          node: name,
          function: fn.name,
          instancePath: `/nodes/${escapePointer(name)}/functions/${i}/transition_to`,
        });
      }
    });
  }

  return issues;
}

/** An Ajv error as a `schema` issue, worded and located the way Pydantic's would be. */
function schemaIssue(error: ErrorObject): LocatedIssue {
  const params = error.params as Record<string, unknown>;
  const segments = error.instancePath.split("/").slice(1).map(unescapePointer);
  let loc = segments;
  let message = error.message ?? error.keyword;
  if (error.keyword === "additionalProperties" && typeof params.additionalProperty === "string") {
    loc = [...segments, params.additionalProperty];
    message = "unknown key";
  } else if (error.keyword === "required" && typeof params.missingProperty === "string") {
    loc = [...segments, params.missingProperty];
    message = "field required";
  }
  const node = segments[0] === "nodes" && segments[1] !== undefined ? segments[1] : undefined;
  const instancePath =
    error.keyword === "additionalProperties"
      ? `${error.instancePath}/${escapePointer(String(params.additionalProperty))}`
      : error.instancePath;
  return {
    level: "error",
    code: "schema",
    message: loc.length > 0 ? `${loc.join(".")}: ${message}` : message,
    ...(node !== undefined ? { node } : {}),
    instancePath,
  };
}

function checkUnique(
  functions: FlowConfigFunction[],
  basePath: string,
  prefix: string,
  where: string,
  issues: LocatedIssue[],
  node?: string
) {
  const seen = new Set<string>();
  functions.forEach((fn, i) => {
    if (seen.has(fn.name)) {
      issues.push({
        level: "error",
        code: "schema",
        message: `${prefix}duplicate function '${fn.name}' in ${where}`,
        ...(node !== undefined ? { node } : {}),
        function: fn.name,
        instancePath: `${basePath}/${i}/name`,
      });
    }
    seen.add(fn.name);
  });
}

function checkTargets(
  fn: FlowConfigFunction,
  basePath: string,
  where: string,
  node: string | undefined,
  nodeNames: Set<string>,
  issues: LocatedIssue[]
) {
  for (const target of functionTargets(fn)) {
    if (!nodeNames.has(target)) {
      issues.push({
        level: "error",
        code: "schema",
        message: `${where} function '${fn.name}' transitions to unknown node '${target}'`,
        ...(node !== undefined ? { node } : {}),
        function: fn.name,
        instancePath: `${basePath}/transition_to`,
      });
    }
  }
}

function checkAction(
  action: FlowConfigAction,
  path: string,
  loc: string,
  node: string,
  issues: LocatedIssue[]
) {
  if (action.type === "function" && !action.handler) {
    issues.push({
      level: "error",
      code: "schema",
      message: `${loc}: a 'function' action requires a 'handler' name`,
      node,
      instancePath: `${path}/handler`,
    });
  } else if (action.type !== "function" && action.handler != null) {
    issues.push({
      level: "error",
      code: "schema",
      message:
        `${loc}: action type '${action.type}' does not take a 'handler'; ` +
        "register custom action types with FlowManager.register_action",
      node,
      instancePath: `${path}/handler`,
    });
  }
}

/** JSON Pointer escaping (RFC 6901) so node names with `/` or `~` produce valid paths. */
function escapePointer(segment: string): string {
  return segment.replace(/~/g, "~0").replace(/\//g, "~1");
}

function unescapePointer(segment: string): string {
  return segment.replace(/~1/g, "/").replace(/~0/g, "~");
}
