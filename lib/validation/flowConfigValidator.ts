/**
 * Validates a `FlowConfig` document the way Pipecat does: structurally against
 * the shipped JSON Schema, then by cross-reference checks that JSON Schema
 * cannot express. The checks mirror `FlowConfig`'s Pydantic validators in
 * `pipecat/flows/config.py` so both sides reject the same documents.
 */

import Ajv2020, { type ErrorObject } from "ajv/dist/2020";

import {
  type FlowConfig,
  type FlowConfigAction,
  type FlowConfigFunction,
  flowConfigSchema,
  functionTargets,
} from "@/lib/schema/flowConfig";

const ajv = new Ajv2020({ allErrors: true, allowUnionTypes: true });
const validateSchema = ajv.compile<FlowConfig>(flowConfigSchema);

export type FlowConfigError = Pick<ErrorObject, "instancePath" | "keyword" | "message" | "params">;

export type FlowConfigValidation =
  | { valid: true; config: FlowConfig; errors: [] }
  | { valid: false; config: null; errors: FlowConfigError[] };

/** Schema validation only. On success the input is typed as a `FlowConfig`. */
export function validateFlowConfigSchema(data: unknown): FlowConfigValidation {
  if (validateSchema(data)) return { valid: true, config: data, errors: [] };
  const errors = (validateSchema.errors ?? []).map(
    ({ instancePath, keyword, message, params }) => ({
      instancePath,
      keyword,
      message,
      params,
    })
  );
  return { valid: false, config: null, errors };
}

/** Schema validation followed by the cross-reference checks. */
export function validateFlowConfig(data: unknown): FlowConfigValidation {
  const structural = validateFlowConfigSchema(data);
  if (!structural.valid) return structural;
  const errors = checkFlowConfigReferences(structural.config);
  if (errors.length > 0) return { valid: false, config: null, errors };
  return structural;
}

/**
 * The rules from `FlowConfig._check_graph`, `Node._check_unique_function_names`,
 * and `Action._check_handler`, in that module's order and wording:
 *
 * - `initial_node` names a defined node.
 * - Function names are unique in `global_functions` and within each node.
 * - A node's function does not share a name with a global function.
 * - Every destination, including branch cases and defaults, names a node.
 * - A `function` action has a `handler`; no other action type does.
 */
export function checkFlowConfigReferences(config: FlowConfig): FlowConfigError[] {
  const errors: FlowConfigError[] = [];
  const nodeNames = new Set(Object.keys(config.nodes));
  const globalFunctions = config.global_functions ?? [];

  if (!nodeNames.has(config.initial_node)) {
    errors.push({
      instancePath: "/initial_node",
      keyword: "initialNodeExists",
      params: { name: config.initial_node },
      message: `initial_node '${config.initial_node}' is not a defined node`,
    });
  }

  checkUnique(globalFunctions, "/global_functions", "global_functions", errors);
  const globalNames = new Set(globalFunctions.map((fn) => fn.name));

  for (const [nodeName, node] of Object.entries(config.nodes)) {
    const path = `/nodes/${escapePointer(nodeName)}`;
    const functions = node.functions ?? [];

    checkUnique(functions, `${path}/functions`, "node", errors);

    functions.forEach((fn, i) => {
      if (globalNames.has(fn.name)) {
        errors.push({
          instancePath: `${path}/functions/${i}/name`,
          keyword: "functionNotGlobal",
          params: { node: nodeName, name: fn.name },
          message: `node '${nodeName}' function '${fn.name}' is also a global function`,
        });
      }
    });
    functions.forEach((fn, i) => {
      checkTargets(fn, `${path}/functions/${i}`, `node '${nodeName}'`, nodeNames, errors);
    });

    (node.pre_actions ?? []).forEach((action, i) => {
      checkAction(action, `${path}/pre_actions/${i}`, errors);
    });
    (node.post_actions ?? []).forEach((action, i) => {
      checkAction(action, `${path}/post_actions/${i}`, errors);
    });
  }

  globalFunctions.forEach((fn, i) => {
    checkTargets(fn, `/global_functions/${i}`, "global_functions", nodeNames, errors);
  });

  return errors;
}

function checkUnique(
  functions: FlowConfigFunction[],
  basePath: string,
  where: string,
  errors: FlowConfigError[]
) {
  const seen = new Set<string>();
  functions.forEach((fn, i) => {
    if (seen.has(fn.name)) {
      errors.push({
        instancePath: `${basePath}/${i}/name`,
        keyword: "uniqueFunctionName",
        params: { name: fn.name },
        message: `duplicate function '${fn.name}' in ${where}`,
      });
    }
    seen.add(fn.name);
  });
}

function checkTargets(
  fn: FlowConfigFunction,
  basePath: string,
  where: string,
  nodeNames: Set<string>,
  errors: FlowConfigError[]
) {
  for (const target of functionTargets(fn)) {
    if (!nodeNames.has(target)) {
      errors.push({
        instancePath: `${basePath}/transition_to`,
        keyword: "transitionTargetExists",
        params: { name: fn.name, target },
        message: `${where} function '${fn.name}' transitions to unknown node '${target}'`,
      });
    }
  }
}

function checkAction(action: FlowConfigAction, path: string, errors: FlowConfigError[]) {
  if (action.type === "function" && !action.handler) {
    errors.push({
      instancePath: `${path}/handler`,
      keyword: "actionHandlerRequired",
      params: { type: action.type },
      message: "a 'function' action requires a 'handler' name",
    });
  } else if (action.type !== "function" && action.handler != null) {
    errors.push({
      instancePath: `${path}/handler`,
      keyword: "actionHandlerNotAllowed",
      params: { type: action.type },
      message:
        `action type '${action.type}' does not take a 'handler'; ` +
        "register custom action types with FlowManager.register_action",
    });
  }
}

/** JSON Pointer escaping (RFC 6901) so node names with `/` or `~` produce valid paths. */
function escapePointer(segment: string): string {
  return segment.replace(/~/g, "~0").replace(/\//g, "~1");
}
