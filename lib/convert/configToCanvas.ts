/**
 * Maps a `FlowConfig` to the canvas. The config is the document; the nodes
 * and edges here are a view of it, rebuilt from the config whenever it changes.
 *
 * - One canvas node per config node, with the node name as its id.
 * - One edge per function with a node-name destination.
 * - One branch (decision) node per function with a branch table, with an edge
 *   in from the node and one edge out per case plus one for the default.
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
export type CanvasNodeType = ConfigNodeType | "decision";

/** Data on a canvas node that stands for a config node. */
export interface ConfigNodeData extends FlowConfigNode {
  label: string;
  name: string;
  type: ConfigNodeType;
  [key: string]: unknown;
}

/** Data on a branch (decision) node derived from a function's branch table. */
export interface BranchNodeData {
  label: string;
  type: "decision";
  sourceNodeId: string;
  functionName: string;
  field: string;
  caseCount: number;
  hasDefault: boolean;
  [key: string]: unknown;
}

export type ConfigCanvasNode = Node<ConfigNodeData, ConfigNodeType>;
export type BranchCanvasNode = Node<BranchNodeData, "decision">;
export type CanvasNode = ConfigCanvasNode | BranchCanvasNode;

export type CanvasEdgeKind = "transition" | "branch" | "case" | "default";

/**
 * What an edge stands for in the config, so selection and deletion can find
 * the function entry without parsing ids. `kind` is `transition` for a
 * node-name destination, `branch` for the edge into a branch node, and
 * `case` or `default` for the edges out of one.
 */
export interface CanvasEdgeData {
  sourceNodeId: string;
  functionName: string;
  kind: CanvasEdgeKind;
  caseValue?: string;
  /** Index of the case among the branch's cases, in config order. */
  caseIndex?: number;
  [key: string]: unknown;
}

export type CanvasEdge = Edge<CanvasEdgeData>;

export function isConfigNode(node: CanvasNode): node is ConfigCanvasNode {
  return node.type !== "decision";
}

export function isBranchNode(node: CanvasNode): node is BranchCanvasNode {
  return node.type === "decision";
}

/** The functions on a canvas node; a branch node has none. */
export function nodeFunctions(node: CanvasNode | undefined): FlowConfigFunction[] {
  return node && isConfigNode(node) ? (node.data.functions ?? []) : [];
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

export function branchNodeId(sourceNodeId: string, functionName: string): string {
  return ["branch", sourceNodeId, functionName].join(ID_SEPARATOR);
}

/** Inverse of `branchNodeId`, or null for an id that is not a branch node's. */
export function parseBranchNodeId(
  id: string
): { sourceNodeId: string; functionName: string } | null {
  const [kind, sourceNodeId, ...rest] = id.split(ID_SEPARATOR);
  if (kind !== "branch" || !sourceNodeId || rest.length === 0) return null;
  return { sourceNodeId, functionName: rest.join(ID_SEPARATOR) };
}

export function transitionEdgeId(sourceNodeId: string, functionName: string): string {
  return ["edge", sourceNodeId, functionName].join(ID_SEPARATOR);
}

export function branchCaseEdgeId(branchId: string, caseValue: string): string {
  return [branchId, "case", caseValue].join(ID_SEPARATOR);
}

export function branchDefaultEdgeId(branchId: string): string {
  return [branchId, "default"].join(ID_SEPARATOR);
}

/** Nodes and edges for a config, without positions. */
export function configToGraph(config: FlowConfig): Canvas {
  const nodes: CanvasNode[] = [];
  const edges: CanvasEdge[] = [];

  for (const [name, node] of Object.entries(config.nodes)) {
    nodes.push({
      id: name,
      type: deriveConfigNodeType(name, node, config.initial_node),
      position: { x: 0, y: 0 },
      data: {
        ...node,
        label: name,
        name,
        type: deriveConfigNodeType(name, node, config.initial_node),
      },
    });
  }

  for (const [name, node] of Object.entries(config.nodes)) {
    for (const fn of node.functions ?? []) {
      const transition = fn.transition_to;
      if (transition === undefined || transition === null) continue;
      if (isBranch(transition)) {
        const branch = branchCanvasNode(name, fn, transition);
        nodes.push(branch);
        edges.push(...branchEdges(name, fn, transition, branch.id));
      } else {
        edges.push(transitionEdge(name, fn.name, transition));
      }
    }
  }

  return { nodes, edges };
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

function transitionEdge(sourceNodeId: string, functionName: string, target: string): CanvasEdge {
  return {
    id: transitionEdgeId(sourceNodeId, functionName),
    source: sourceNodeId,
    target,
    label: functionName,
    type: sourceNodeId === target ? "selfloop" : "default",
    data: { sourceNodeId, functionName, kind: "transition" },
  };
}

/** The canvas node for a function's branch table, at the origin. */
export function branchCanvasNode(
  sourceNodeId: string,
  fn: FlowConfigFunction,
  branch: FlowConfigBranch
): BranchCanvasNode {
  return {
    id: branchNodeId(sourceNodeId, fn.name),
    type: "decision",
    position: { x: 0, y: 0 },
    data: {
      label: fn.name,
      type: "decision",
      sourceNodeId,
      functionName: fn.name,
      field: branch.field,
      caseCount: Object.keys(branch.cases).length,
      hasDefault: Boolean(branch.default),
    },
  };
}

function branchEdges(
  sourceNodeId: string,
  fn: FlowConfigFunction,
  branch: FlowConfigBranch,
  branchId: string
): CanvasEdge[] {
  const edges: CanvasEdge[] = [
    {
      id: transitionEdgeId(sourceNodeId, fn.name),
      source: sourceNodeId,
      target: branchId,
      label: fn.name,
      type: "default",
      data: { sourceNodeId, functionName: fn.name, kind: "branch" },
    },
  ];
  Object.entries(branch.cases).forEach(([value, target], caseIndex) => {
    edges.push({
      id: branchCaseEdgeId(branchId, value),
      source: branchId,
      target,
      label: value,
      type: "default",
      data: { sourceNodeId, functionName: fn.name, kind: "case", caseValue: value, caseIndex },
    });
  });
  if (branch.default) {
    edges.push({
      id: branchDefaultEdgeId(branchId),
      source: branchId,
      target: branch.default,
      label: "default",
      type: "default",
      data: { sourceNodeId, functionName: fn.name, kind: "default" },
    });
  }
  return edges;
}
