/**
 * Turns the canvas back into YAML text. When the flow was opened from a file,
 * the edits are merged into that file's document so its comments survive.
 */

import type { Document } from "yaml";

import { canvasToConfig } from "@/lib/convert/canvasToConfig";
import type { CanvasNode } from "@/lib/convert/configToCanvas";
import type { FlowConfig, FlowConfigFunction } from "@/lib/schema/flowConfig";
import {
  checkFlowConfigReferences,
  type FlowConfigError,
} from "@/lib/validation/flowConfigValidator";

import { applyConfigToDocument, createFlowDocument, stringifyFlowDocument } from "./flowDocument";

export interface SerializedFlow {
  text: string;
  config: FlowConfig;
  /** The document the text came from; the one passed in, updated in place, or a new one. */
  document: Document;
  referenceErrors: FlowConfigError[];
}

export function serializeFlow(
  nodes: CanvasNode[],
  options: { document: Document | null; globalFunctions: FlowConfigFunction[] }
): SerializedFlow {
  const config = canvasToConfig(nodes, options.globalFunctions);
  let document = options.document;
  if (document) {
    applyConfigToDocument(document, config);
  } else {
    document = createFlowDocument(config);
  }
  return {
    text: stringifyFlowDocument(document),
    config,
    document,
    referenceErrors: checkFlowConfigReferences(config),
  };
}
