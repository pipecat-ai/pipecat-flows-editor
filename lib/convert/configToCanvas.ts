/**
 * Maps a `FlowConfig` to the canvas. The config is the document; the nodes
 * and edges here are a view of it, rebuilt from the config whenever it changes.
 *
 * - One canvas node per config node, with the node name as its id. The node
 *   card lists the node's functions as rows, and a branch function's cases
 *   as sub-rows, each with its own source handle.
 * - One edge per destination, from the row's handle to the target node.
 *   Edges carry no label; the row is the label.
 *
 * Global functions have no source node, so they draw no edges; the flow-level
 * inspector lists them. Positions come from stored positions when present and
 * from auto-layout otherwise; see `lib/storage/positionStore.ts`.
 */

import type { Edge, Node } from "@xyflow/react";

import { layoutNodes, type LayoutOptions } from "@/lib/layout/autoLayout";
import {
  type FlowConfig,
  type FlowConfigBranch,
  type FlowConfigFunction,
  type FlowConfigNode,
  isBranch,
} from "@/lib/schema/flowConfig";
import type { NodePositions } from "@/lib/storage/positionStore";

export type ConfigNodeType = "initial" | "node" | "end";
export type CanvasNodeType = ConfigNodeType;

/** Data on a canvas node that stands for a config node. */
export interface ConfigNodeData extends FlowConfigNode {
  label: string;
  name: string;
  type: ConfigNodeType;
  [key: string]: unknown;
}

export type ConfigCanvasNode = Node<ConfigNodeData, ConfigNodeType>;
export type CanvasNode = ConfigCanvasNode;

export type CanvasEdgeKind = "transition" | "case" | "default";

/**
 * What an edge stands for in the config, so selection and deletion can find
 * the function entry without parsing ids. `kind` is `transition` for a
 * node-name destination and `case` or `default` for a row of a branch table.
 */
export interface CanvasEdgeData {
  sourceNodeId: string;
  /** Index of the function on the source node. Names can be empty or repeated mid-edit; indexes cannot. */
  functionIndex: number;
  kind: CanvasEdgeKind;
  caseValue?: string;
  /** Index of the case among the branch's cases, in config order. */
  caseIndex?: number;
  [key: string]: unknown;
}

export type CanvasEdge = Edge<CanvasEdgeData>;

export function isConfigNode(node: CanvasNode): node is ConfigCanvasNode {
  return true;
}

/** The functions on a canvas node. */
export function nodeFunctions(node: CanvasNode | undefined): FlowConfigFunction[] {
  return node?.data.functions ?? [];
}

export interface Canvas {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

export interface ConfigToCanvasOptions {
  /** Stored positions, applied over the auto-layout for the nodes they cover. */
  positions?: NodePositions;
  layout?: LayoutOptions;
}

const ID_SEPARATOR = ":";

/**
 * Source handles on a node card, one per row that can lead somewhere:
 * a function without a branch, each case of a branch, its default, and the
 * "add a case" row; plus the node's own handle for adding a function.
 * Functions are addressed by index, since a name can be empty or repeated
 * while it is being typed.
 */
export type HandleRef =
  | { kind: "function"; functionIndex: number }
  | { kind: "case"; functionIndex: number; caseValue: string }
  | { kind: "default"; functionIndex: number }
  | { kind: "new-case"; functionIndex: number }
  | { kind: "new-function" };

export const NEW_FUNCTION_HANDLE = "new-function";

export function handleId(ref: HandleRef): string {
  switch (ref.kind) {
    case "new-function":
      return NEW_FUNCTION_HANDLE;
    case "function":
      return ["fn", ref.functionIndex].join(ID_SEPARATOR);
    case "case":
      return ["fn", ref.functionIndex, "case", ref.caseValue].join(ID_SEPARATOR);
    case "default":
      return ["fn", ref.functionIndex, "default"].join(ID_SEPARATOR);
    case "new-case":
      return ["fn", ref.functionIndex, "new-case"].join(ID_SEPARATOR);
  }
}

/** Inverse of `handleId`. A missing or unknown handle is the node's own. */
export function parseHandleId(id: string | null | undefined): HandleRef {
  if (!id || id === NEW_FUNCTION_HANDLE) return { kind: "new-function" };
  const [prefix, index, kind, ...rest] = id.split(ID_SEPARATOR);
  const functionIndex = Number(index);
  if (prefix !== "fn" || !Number.isInteger(functionIndex) || functionIndex < 0) {
    return { kind: "new-function" };
  }
  if (kind === undefined) return { kind: "function", functionIndex };
  if (kind === "case") return { kind: "case", functionIndex, caseValue: rest.join(ID_SEPARATOR) };
  if (kind === "default") return { kind: "default", functionIndex };
  if (kind === "new-case") return { kind: "new-case", functionIndex };
  return { kind: "new-function" };
}

/**
 * The display type of a config node. The initial node is whichever node
 * `initial_node` names; an end node has an `end_conversation` post-action;
 * everything else is a node.
 */
export function deriveConfigNodeType(
  name: string,
  node: FlowConfigNode,
  initialNode: string
): ConfigNodeType {
  if (name === initialNode) return "initial";
  if ((node.post_actions ?? []).some((action) => action.type === "end_conversation")) return "end";
  return "node";
}

export function transitionEdgeId(sourceNodeId: string, functionIndex: number): string {
  return ["edge", sourceNodeId, functionIndex].join(ID_SEPARATOR);
}

export function branchCaseEdgeId(sourceNodeId: string, functionIndex: number, caseValue: string) {
  return ["edge", sourceNodeId, functionIndex, "case", caseValue].join(ID_SEPARATOR);
}

export function branchDefaultEdgeId(sourceNodeId: string, functionIndex: number): string {
  return ["edge", sourceNodeId, functionIndex, "default"].join(ID_SEPARATOR);
}

/** Nodes and edges for a config, without positions. */
export function configToGraph(config: FlowConfig): Canvas {
  const nodes: CanvasNode[] = [];
  for (const [name, node] of Object.entries(config.nodes)) {
    const type = deriveConfigNodeType(name, node, config.initial_node);
    nodes.push({
      id: name,
      type,
      position: { x: 0, y: 0 },
      data: { ...node, label: name, name, type },
    });
  }
  return { nodes, edges: edgesForNodes(nodes) };
}

/** The edges the nodes' function entries call for. */
export function edgesForNodes(nodes: CanvasNode[]): CanvasEdge[] {
  const edges: CanvasEdge[] = [];
  for (const node of nodes) {
    (node.data.functions ?? []).forEach((fn, functionIndex) => {
      const transition = fn.transition_to;
      if (transition === undefined || transition === null) return;
      if (isBranch(transition)) {
        edges.push(...branchEdges(node.id, functionIndex, transition));
      } else {
        edges.push(transitionEdge(node.id, functionIndex, transition));
      }
    });
  }
  return edges;
}

/** Nodes and edges for a config, positioned by stored positions and auto-layout. */
export function configToCanvas(config: FlowConfig, options: ConfigToCanvasOptions = {}): Canvas {
  const graph = configToGraph(config);
  const laidOut = layoutNodes(graph.nodes, graph.edges, options.layout);
  const positions = options.positions ?? {};
  const nodes = laidOut.map((node) =>
    positions[node.id] ? { ...node, position: { ...positions[node.id] } } : node
  );
  return { nodes, edges: graph.edges };
}

function edge(
  id: string,
  sourceNodeId: string,
  handle: HandleRef,
  target: string,
  data: CanvasEdgeData
): CanvasEdge {
  return {
    id,
    source: sourceNodeId,
    sourceHandle: handleId(handle),
    target,
    type: sourceNodeId === target ? "selfloop" : "default",
    data,
  };
}

function transitionEdge(sourceNodeId: string, functionIndex: number, target: string): CanvasEdge {
  return edge(
    transitionEdgeId(sourceNodeId, functionIndex),
    sourceNodeId,
    { kind: "function", functionIndex },
    target,
    { sourceNodeId, functionIndex, kind: "transition" }
  );
}

function branchEdges(
  sourceNodeId: string,
  functionIndex: number,
  branch: FlowConfigBranch
): CanvasEdge[] {
  const edges = Object.entries(branch.cases).map(([caseValue, target], caseIndex) =>
    edge(
      branchCaseEdgeId(sourceNodeId, functionIndex, caseValue),
      sourceNodeId,
      { kind: "case", functionIndex, caseValue },
      target,
      { sourceNodeId, functionIndex, kind: "case", caseValue, caseIndex }
    )
  );
  if (branch.default) {
    edges.push(
      edge(
        branchDefaultEdgeId(sourceNodeId, functionIndex),
        sourceNodeId,
        { kind: "default", functionIndex },
        branch.default,
        { sourceNodeId, functionIndex, kind: "default" }
      )
    );
  }
  return edges;
}
