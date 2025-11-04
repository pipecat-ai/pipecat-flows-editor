import Ajv, { type ErrorObject } from "ajv";
import addFormats from "ajv-formats";
import { getCompiledJsonSchema, type FlowJson } from "@/lib/schema/flow.schema";

const ajv = new Ajv({ allErrors: true, allowUnionTypes: true, strict: false });
addFormats(ajv);

const flowSchema = getCompiledJsonSchema();
ajv.addSchema(flowSchema, flowSchema.$id as string);

const validateFlow =
  ajv.getSchema<FlowJson>(flowSchema.$id as string) ?? ajv.compile<FlowJson>(flowSchema as any);

export type ValidationResult = {
  valid: boolean;
  errors: ErrorObject[] | null | undefined;
};

export function validateFlowJson(json: unknown): ValidationResult {
  const isValid = validateFlow(json);
  return { valid: Boolean(isValid), errors: validateFlow.errors };
}

export function customGraphChecks(flow: FlowJson): ErrorObject[] {
  const errors: ErrorObject[] = [];
  // Unique node ids
  const ids = new Set<string>();
  for (const n of flow.nodes) {
    if (ids.has(n.id)) {
      errors.push({
        instancePath: `/nodes/${n.id}`,
        schemaPath: "#/uniqueNodeIds",
        keyword: "uniqueNodeId",
        params: { id: n.id },
        message: `Duplicate node id: ${n.id}`,
      } as ErrorObject);
    }
    ids.add(n.id);
  }
  // Edge endpoints exist
  const nodeIds = new Set(flow.nodes.map((n) => n.id));
  flow.edges.forEach((e, i) => {
    if (!nodeIds.has(e.source)) {
      errors.push({
        instancePath: `/edges/${i}/source`,
        schemaPath: "#/edgeSourceExists",
        keyword: "edgeSourceExists",
        params: { source: e.source },
        message: `Edge source not found: ${e.source}`,
      } as ErrorObject);
    }
    if (!nodeIds.has(e.target)) {
      errors.push({
        instancePath: `/edges/${i}/target`,
        schemaPath: "#/edgeTargetExists",
        keyword: "edgeTargetExists",
        params: { target: e.target },
        message: `Edge target not found: ${e.target}`,
      } as ErrorObject);
    }
  });
  return errors;
}
