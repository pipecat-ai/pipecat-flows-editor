/**
 * The flow's YAML document. The `yaml` package's document API keeps comments,
 * key order, and scalar styles across a round trip, so a hand-written file
 * that came in with comments goes out with them. Edits are merged into the
 * existing document rather than regenerated from scratch.
 */

import {
  Document,
  isCollection,
  isMap,
  isNode,
  isScalar,
  isSeq,
  LineCounter,
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

/** A problem in the YAML text, located for an editor. Lines and columns are 1-based. */
export interface FlowProblem {
  message: string;
  /** Errors keep the flow from loading; warnings are unresolved references. */
  severity: "error" | "warning";
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export interface ParsedFlow {
  document: Document;
  /** The config when the YAML parsed and matched the schema; otherwise null. */
  config: FlowConfig | null;
  yamlErrors: string[];
  schemaErrors: FlowConfigError[];
  /** Cross-reference errors. A flow with these still opens; the canvas shows them. */
  referenceErrors: FlowConfigError[];
  /** Every error above, located in the text. */
  problems: FlowProblem[];
}

export function parseFlowYaml(text: string): ParsedFlow {
  const lineCounter = new LineCounter();
  const document = parseDocument(text, { prettyErrors: true, lineCounter });
  const locate = (path: string, params: Record<string, unknown>) =>
    rangeForPath(document, lineCounter, path, params);

  const yamlErrors = document.errors.map((error) => error.message);
  if (yamlErrors.length > 0) {
    const problems = document.errors.map((error) => {
      const [start, end] = error.linePos ?? [{ line: 1, col: 1 }];
      return {
        message: error.message.split("\n")[0],
        severity: "error" as const,
        startLine: start.line,
        startColumn: start.col,
        endLine: (end ?? start).line,
        endColumn: (end ?? start).col,
      };
    });
    return { document, config: null, yamlErrors, schemaErrors: [], referenceErrors: [], problems };
  }

  const schema = validateFlowConfigSchema(document.toJS());
  if (!schema.valid) {
    const problems = schema.errors.map((error) => ({
      message: describeSchemaError(error),
      severity: "error" as const,
      ...locate(error.instancePath, error.params ?? {}),
    }));
    return {
      document,
      config: null,
      yamlErrors,
      schemaErrors: schema.errors,
      referenceErrors: [],
      problems,
    };
  }

  const referenceErrors = checkFlowConfigReferences(schema.config);
  const problems = referenceErrors.map((error) => ({
    message: error.message ?? "Unresolved reference",
    severity: "warning" as const,
    ...locate(error.instancePath, error.params ?? {}),
  }));
  return {
    document,
    config: schema.config,
    yamlErrors,
    schemaErrors: [],
    referenceErrors,
    problems,
  };
}

function describeSchemaError(error: FlowConfigError): string {
  const params = error.params as Record<string, unknown> | undefined;
  if (error.keyword === "additionalProperties") {
    return `unknown key '${params?.additionalProperty}'`;
  }
  if (error.keyword === "required") {
    return `missing required key '${params?.missingProperty}'`;
  }
  return error.message ?? error.keyword;
}

type TextRange = Pick<FlowProblem, "startLine" | "startColumn" | "endLine" | "endColumn">;

/**
 * Where a JSON-pointer path lands in the text. A missing key points at the
 * object that lacks it, an unknown key at that key, and a collection at the
 * line its key is on rather than its whole body.
 */
function rangeForPath(
  document: Document,
  lineCounter: LineCounter,
  instancePath: string,
  params: Record<string, unknown>
): TextRange {
  const segments = instancePath
    .split("/")
    .slice(1)
    .map((segment) => segment.replace(/~1/g, "/").replace(/~0/g, "~"));

  if (typeof params.additionalProperty === "string") {
    const parent = document.getIn(segments, true);
    if (isMap(parent)) {
      const pair = parent.items.find((p) => keyOf(p) === params.additionalProperty);
      if (pair && isNode(pair.key)) return toRange(lineCounter, pair.key.range, true);
    }
  }

  for (let depth = segments.length; depth > 0; depth -= 1) {
    const path = segments.slice(0, depth);
    const parent = document.getIn(path.slice(0, -1), true);
    const last = path[path.length - 1];
    if (isMap(parent)) {
      const pair = parent.items.find((p) => keyOf(p) === last);
      if (!pair) continue;
      const value = pair.value;
      if (isNode(value) && !isCollection(value) && value.range) {
        return toRange(lineCounter, value.range, false);
      }
      if (isNode(pair.key)) return toRange(lineCounter, pair.key.range, true);
    } else if (isSeq(parent)) {
      const item = parent.items[Number(last)];
      if (isNode(item) && item.range) return toRange(lineCounter, item.range, isCollection(item));
    }
  }

  const root = document.contents;
  if (isNode(root) && root.range) return toRange(lineCounter, root.range, true);
  return { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 };
}

function toRange(
  lineCounter: LineCounter,
  range: [number, number, number] | null | undefined,
  firstLineOnly: boolean
): TextRange {
  if (!range) return { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 };
  const start = lineCounter.linePos(range[0]);
  const end = lineCounter.linePos(range[1]);
  if (firstLineOnly && end.line > start.line) {
    return {
      startLine: start.line,
      startColumn: start.col,
      endLine: start.line,
      endColumn: Number.MAX_SAFE_INTEGER,
    };
  }
  return { startLine: start.line, startColumn: start.col, endLine: end.line, endColumn: end.col };
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
