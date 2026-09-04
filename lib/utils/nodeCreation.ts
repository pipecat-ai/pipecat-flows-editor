/**
 * Adding to the graph from a node. In a FlowConfig a node only matters if
 * something leads to it, so the gesture is "add a destination": a new node
 * plus the function entry on the source that routes to it. Every node made
 * this way is reachable by construction.
 */

import {
  branchCanvasNode,
  type CanvasNode,
  type ConfigCanvasNode,
  isBranchNode,
  isConfigNode,
  nodeFunctions,
  parseBranchNodeId,
} from "@/lib/convert/configToCanvas";
import { BRANCH_NODE_SIZE } from "@/lib/layout/autoLayout";
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

const CHILD_GAP_Y = 100;
const CHILD_SPACING_X = 220;
const DEFAULT_NODE_HEIGHT = 40;

/** A placeholder tool name that no function on the node uses yet. */
export function newFunctionName(functions: FlowConfigFunction[]): string {
  const names = functions.map((fn) => fn.name).filter(Boolean);
  return generateNodeIdFromLabel(`function_${names.length + 1}`, names);
}

/** Below the source, fanned out to the right past its existing destinations. */
function placeBelow(source: CanvasNode, siblingCount: number) {
  return {
    x: source.position.x + siblingCount * CHILD_SPACING_X,
    y: source.position.y + (source.measured?.height ?? DEFAULT_NODE_HEIGHT) + CHILD_GAP_Y,
  };
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

/** Adds a new node and a function on `sourceId` leading to it. */
export function addDestination(
  nodes: CanvasNode[],
  sourceId: string,
  kind: DestinationKind
): Added | null {
  const source = nodes.find((n) => n.id === sourceId);
  if (!source || !isConfigNode(source)) return null;

  const functions = nodeFunctions(source);
  const siblingCount = functions.filter((fn) => functionTargets(fn).length > 0).length;
  const below = placeBelow(source, siblingCount);

  // A branch puts its diamond one level down and the new node one further,
  // so the two do not land on the same spot.
  const nodePosition =
    kind === "branch" ? { x: below.x, y: below.y + BRANCH_NODE_SIZE.height + CHILD_GAP_Y } : below;
  const node = newNode(
    kind === "end" ? "end" : "node",
    nodePosition,
    nodes.map((n) => n.id)
  );
  const fn: FlowConfigFunction =
    kind === "branch"
      ? {
          name: newFunctionName(functions),
          transition_to: { field: "", cases: { value_1: node.id } },
        }
      : { name: newFunctionName(functions), transition_to: node.id };
  const added: CanvasNode[] = [node];
  if (isBranch(fn.transition_to)) {
    added.unshift({ ...branchCanvasNode(sourceId, fn, fn.transition_to), position: below });
  }

  const updated = nodes.map((n) =>
    n.id === sourceId && isConfigNode(n)
      ? { ...n, data: { ...n.data, functions: [...functions, fn] } }
      : n
  );
  return {
    nodes: [...updated, ...added],
    newNodeId: node.id,
    sourceNodeId: sourceId,
    functionIndex: functions.length,
    caseIndex: kind === "branch" ? 0 : undefined,
  };
}

/** Adds a new node and a case on the branch node's table leading to it. */
export function addBranchCaseDestination(nodes: CanvasNode[], branchId: string): Added | null {
  const branch = nodes.find((n) => n.id === branchId);
  const parsed = parseBranchNodeId(branchId);
  if (!branch || !isBranchNode(branch) || !parsed) return null;
  const source = nodes.find((n) => n.id === parsed.sourceNodeId);
  if (!source || !isConfigNode(source)) return null;

  const functions = nodeFunctions(source);
  const functionIndex = functions.findIndex(
    (fn) => fn.name === parsed.functionName && isBranch(fn.transition_to)
  );
  const fn = functions[functionIndex];
  if (!fn || !isBranch(fn.transition_to)) return null;

  const siblingCount =
    Object.keys(fn.transition_to.cases).length + (fn.transition_to.default ? 1 : 0);
  const node = newNode(
    "node",
    placeBelow(branch, siblingCount),
    nodes.map((n) => n.id)
  );
  const updatedFn: FlowConfigFunction = {
    ...fn,
    transition_to: { ...fn.transition_to, cases: addCase(fn.transition_to.cases, node.id) },
  };
  const updated = nodes.map((n) =>
    n.id === source.id && isConfigNode(n)
      ? {
          ...n,
          data: {
            ...n.data,
            functions: functions.map((f, i) => (i === functionIndex ? updatedFn : f)),
          },
        }
      : n
  );
  return {
    nodes: [...updated, node],
    newNodeId: node.id,
    sourceNodeId: source.id,
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
  if (!nodes.some((n) => n.id === nodeId && isConfigNode(n))) return nodes;
  return nodes.map((n) => {
    if (!isConfigNode(n)) return n;
    if (n.id === nodeId) return { ...n, type: "initial", data: { ...n.data, type: "initial" } };
    if (n.type === "initial") {
      const type = deriveNodeType(n.data, "node");
      return { ...n, type, data: { ...n.data, type } };
    }
    return n;
  });
}
