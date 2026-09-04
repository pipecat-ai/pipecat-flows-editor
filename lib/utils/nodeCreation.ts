/**
 * Adding to the graph from a node. In a FlowConfig a node only matters if
 * something leads to it, so the gesture is "add a destination": a new node
 * plus the function entry, or branch case, on the source that routes to it.
 * Every node made this way is reachable by construction.
 */

import {
  type CanvasNode,
  type ConfigCanvasNode,
  nodeFunctions,
} from "@/lib/convert/configToCanvas";
import { getTemplateByType } from "@/lib/nodes/templates";
import { type FlowConfigFunction, functionTargets, isBranch } from "@/lib/schema/flowConfig";

import { addCase } from "./branchEdits";
import { generateNodeIdFromLabel } from "./nodeId";
import { deriveNodeType } from "./nodeType";

/** What the new destination is: a node, an end node, or a branch whose first case leads to a new node. */
export type DestinationKind = "node" | "end" | "branch";

export interface Added {
  nodes: CanvasNode[];
  newNodeId: string;
  /** The function on the source node that routes to the new node. */
  sourceNodeId: string;
  functionIndex: number;
  /** For a branch case, its index among the cases. */
  caseIndex?: number;
}

const CHILD_GAP_X = 90;
const CHILD_SPACING_Y = 120;
const DEFAULT_NODE_WIDTH = 220;

/** A placeholder tool name that no function on the node uses yet. */
export function newFunctionName(functions: FlowConfigFunction[]): string {
  const names = functions.map((fn) => fn.name).filter(Boolean);
  return generateNodeIdFromLabel(`function_${names.length + 1}`, names);
}

/** To the right of the source, stacked downward past its existing destinations. */
function placeBeside(source: CanvasNode, siblingCount: number) {
  return {
    x: source.position.x + (source.measured?.width ?? DEFAULT_NODE_WIDTH) + CHILD_GAP_X,
    y: source.position.y + siblingCount * CHILD_SPACING_Y,
  };
}

function destinationCount(functions: FlowConfigFunction[]): number {
  return functions.reduce((count, fn) => count + functionTargets(fn).length, 0);
}

function newNode(
  kind: "node" | "end",
  position: { x: number; y: number },
  existingIds: string[]
): ConfigCanvasNode {
  const template = getTemplateByType(kind)!;
  const id = generateNodeIdFromLabel(kind, existingIds);
  const type = deriveNodeType(template.node, kind);
  return { id, type, position, data: { ...template.node, name: id, label: id, type } };
}

function withFunctions(
  nodes: CanvasNode[],
  sourceId: string,
  functions: FlowConfigFunction[]
): CanvasNode[] {
  return nodes.map((n) => (n.id === sourceId ? { ...n, data: { ...n.data, functions } } : n));
}

/** Adds a new node and a new function on `sourceId` leading to it. */
export function addDestination(
  nodes: CanvasNode[],
  sourceId: string,
  kind: DestinationKind
): Added | null {
  const source = nodes.find((n) => n.id === sourceId);
  if (!source) return null;
  const functions = nodeFunctions(source);
  const node = newNode(
    kind === "end" ? "end" : "node",
    placeBeside(source, destinationCount(functions)),
    nodes.map((n) => n.id)
  );
  const fn: FlowConfigFunction =
    kind === "branch"
      ? {
          name: newFunctionName(functions),
          transition_to: { field: "", cases: { value_1: node.id } },
        }
      : { name: newFunctionName(functions), transition_to: node.id };
  return {
    nodes: [...withFunctions(nodes, sourceId, [...functions, fn]), node],
    newNodeId: node.id,
    sourceNodeId: sourceId,
    functionIndex: functions.length,
    caseIndex: kind === "branch" ? 0 : undefined,
  };
}

/**
 * Gives an existing function without a destination a new node to lead to,
 * as a node, an end node, or a branch whose first case leads there.
 */
export function addFunctionDestination(
  nodes: CanvasNode[],
  sourceId: string,
  functionIndex: number,
  kind: DestinationKind
): Added | null {
  const source = nodes.find((n) => n.id === sourceId);
  const functions = nodeFunctions(source);
  const fn = functions[functionIndex];
  if (!source || !fn || functionTargets(fn).length > 0) return null;
  const node = newNode(
    kind === "end" ? "end" : "node",
    placeBeside(source, destinationCount(functions)),
    nodes.map((n) => n.id)
  );
  const updated: FlowConfigFunction =
    kind === "branch"
      ? { ...fn, transition_to: { field: "", cases: { value_1: node.id } } }
      : { ...fn, transition_to: node.id };
  return {
    nodes: [
      ...withFunctions(
        nodes,
        sourceId,
        functions.map((f, i) => (i === functionIndex ? updated : f))
      ),
      node,
    ],
    newNodeId: node.id,
    sourceNodeId: sourceId,
    functionIndex,
    caseIndex: kind === "branch" ? 0 : undefined,
  };
}

/** Adds a new node and a case on the function's branch table leading to it. */
export function addBranchCaseDestination(
  nodes: CanvasNode[],
  sourceId: string,
  functionIndex: number
): Added | null {
  const source = nodes.find((n) => n.id === sourceId);
  const functions = nodeFunctions(source);
  const fn = functions[functionIndex];
  if (!source || !fn || !isBranch(fn.transition_to)) return null;
  const node = newNode(
    "node",
    placeBeside(source, destinationCount(functions)),
    nodes.map((n) => n.id)
  );
  const updated: FlowConfigFunction = {
    ...fn,
    transition_to: { ...fn.transition_to, cases: addCase(fn.transition_to.cases, node.id) },
  };
  return {
    nodes: [
      ...withFunctions(
        nodes,
        sourceId,
        functions.map((f, i) => (i === functionIndex ? updated : f))
      ),
      node,
    ],
    newNodeId: node.id,
    sourceNodeId: sourceId,
    functionIndex,
    caseIndex: Object.keys(fn.transition_to.cases).length,
  };
}

/**
 * Makes `nodeId` the flow's entry point. `initial_node` is a designation, so
 * the previous initial node becomes an ordinary node and keeps everything
 * else about it.
 */
export function setInitialNode(nodes: CanvasNode[], nodeId: string): CanvasNode[] {
  if (!nodes.some((n) => n.id === nodeId)) return nodes;
  return nodes.map((n) => {
    if (n.id === nodeId) return { ...n, type: "initial", data: { ...n.data, type: "initial" } };
    if (n.type === "initial") {
      const type = deriveNodeType(n.data, "node");
      return { ...n, type, data: { ...n.data, type } };
    }
    return n;
  });
}
