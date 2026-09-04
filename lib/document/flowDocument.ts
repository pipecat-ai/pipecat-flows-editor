/**
 * The flow's YAML document. The `yaml` package's document API keeps comments,
 * key order, and scalar styles across a round trip, so a hand-written file
 * that came in with comments goes out with them. Edits are merged into the
 * existing document rather than regenerated from scratch.
 */

import {
  Document,
  isMap,
  isScalar,
  isSeq,
  type Node as YamlNode,
  Pair,
  parseDocument,
  Scalar,
  YAMLMap,
  YAMLSeq,
} from "yaml";

import type { FlowConfig } from "@/lib/schema/flowConfig";
import {
  checkFlowConfigReferences,
  type FlowConfigError,
  validateFlowConfigSchema,
} from "@/lib/validation/flowConfigValidator";

/** Strings longer than this are written as folded block scalars. */
const FOLD_THRESHOLD = 80;

export const FLOW_FILE_EXTENSION = ".yaml";
export const DEFAULT_FLOW_NAME = "untitled";

export interface ParsedFlow {
  document: Document;
  /** The config when the YAML parsed and matched the schema; otherwise null. */
  config: FlowConfig | null;
  yamlErrors: string[];
  schemaErrors: FlowConfigError[];
  /** Cross-reference errors. A flow with these still opens; the canvas shows them. */
  referenceErrors: FlowConfigError[];
}

export function parseFlowYaml(text: string): ParsedFlow {
  const document = parseDocument(text, { prettyErrors: true });
  const yamlErrors = document.errors.map((error) => error.message);
  if (yamlErrors.length > 0) {
    return { document, config: null, yamlErrors, schemaErrors: [], referenceErrors: [] };
  }
  const schema = validateFlowConfigSchema(document.toJS());
  if (!schema.valid) {
    return { document, config: null, yamlErrors, schemaErrors: schema.errors, referenceErrors: [] };
  }
  return {
    document,
    config: schema.config,
    yamlErrors,
    schemaErrors: [],
    referenceErrors: checkFlowConfigReferences(schema.config),
  };
}

/** A new document for a config, with long strings in block style. */
export function createFlowDocument(config: FlowConfig): Document {
  const document = new Document();
  document.contents = buildNode(config);
  return document;
}

/**
 * Writes `config` into `document` in place. Existing keys keep their comments,
 * order, and scalar style; keys absent from the config are removed; new keys
 * are appended.
 */
export function applyConfigToDocument(document: Document, config: FlowConfig): void {
  document.contents = mergeNode(document.contents, config);
}

export function stringifyFlowDocument(document: Document): string {
  return document.toString();
}

/** The flow name for a file: the file name without its extension. */
export function flowNameFromFileName(fileName: string): string {
  const stem = fileName.replace(/\.(ya?ml|json)$/i, "").trim();
  return stem || DEFAULT_FLOW_NAME;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function keyOf(pair: Pair): string {
  return isScalar(pair.key) ? String(pair.key.value) : String(pair.key);
}

function mergeNode(target: unknown, value: unknown): YamlNode {
  if (isPlainObject(value)) {
    if (!isMap(target)) return buildNode(value);
    const keys = new Set(Object.keys(value));
    for (const pair of [...target.items]) {
      if (!keys.has(keyOf(pair))) target.delete(pair.key);
    }
    for (const [key, item] of Object.entries(value)) {
      const existing = target.get(key, true);
      const merged = mergeNode(existing, item);
      if (merged !== existing) target.set(key, merged);
    }
    return target;
  }
  if (Array.isArray(value)) {
    if (!isSeq(target)) return buildNode(value);
    value.forEach((item, i) => {
      const existing = target.items[i];
      const merged = mergeNode(existing, item);
      if (merged !== existing) target.items[i] = merged;
    });
    target.items.length = value.length;
    return target;
  }
  if (isScalar(target)) {
    if (target.value !== value) {
      target.value = value;
      restyleScalar(target);
    }
    return target;
  }
  return buildNode(value);
}

function buildNode(value: unknown): YamlNode {
  if (isPlainObject(value)) {
    const map = new YAMLMap();
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined) continue;
      map.items.push(new Pair(new Scalar(key), buildNode(item)));
    }
    return map;
  }
  if (Array.isArray(value)) {
    const seq = new YAMLSeq();
    for (const item of value) seq.items.push(buildNode(item));
    return seq;
  }
  const scalar = new Scalar(value);
  styleScalar(scalar);
  return scalar;
}

/** Block style for multi-line and long strings, as in Pipecat's example files. */
function styleScalar(scalar: Scalar): void {
  if (typeof scalar.value !== "string") return;
  if (scalar.value.includes("\n")) scalar.type = Scalar.BLOCK_LITERAL;
  else if (scalar.value.length > FOLD_THRESHOLD) scalar.type = Scalar.BLOCK_FOLDED;
}

/** Moves an edited scalar to block style when its new value needs it; block scalars keep their style. */
function restyleScalar(scalar: Scalar): void {
  if (scalar.type === Scalar.BLOCK_LITERAL || scalar.type === Scalar.BLOCK_FOLDED) return;
  styleScalar(scalar);
}
