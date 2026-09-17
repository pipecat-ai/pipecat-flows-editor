/**
 * Maps a `FlowConfig` to the canvas. The config is the document; the nodes
 * and edges here are a view of it, rebuilt from the config whenever it changes.
 *
 * - One canvas node per config node, with the node name as its id. The card
 *   shows the node's actions and the functions that stay on it; each card has
 *   one entry at the top and one exit at the bottom.
 * - One labeled edge per function that leads somewhere, carrying the function
 *   name. A branch function leads to a decision node, a canvas-only diamond
 *   that stands for its branch table, with one edge per case and one for the
 *   default leaving it, labeled by the case value.
 *
 * Decision nodes are derived from the config nodes, never edited directly,
 * and never written to the config. Global functions have no source node, so
 * they draw no edges; the flow-level inspector lists them. Positions come from
 * stored positions when present and from auto-layout otherwise; see
 * `lib/storage/positionStore.ts`.
 */

import type { Edge, Node } from "@xyflow/react";

import { DECISION, layoutNodes, type LayoutOptions, NODE_CARD } from "@/lib/layout/autoLayout";
import {
  type FlowConfig,
  type FlowConfigBranch,
  type FlowConfigFunction,
  type FlowConfigNode,
  isBranch,
} from "@/lib/schema/flowConfig";
import type { NodePositions } from "@/lib/storage/positionStore";

export type ConfigNodeType = "initial" | "node" | "end";

/** Data on a canvas node that stands for a config node. */
export interface ConfigNodeData extends FlowConfigNode {
  label: string;
  name: string;
  type: ConfigNodeType;
  [key: string]: unknown;
}

export type ConfigCanvasNode = Node<ConfigNodeData, ConfigNodeType>;
/** A canvas node that stands for a config node; the helpers under lib/utils work on these. */
export type CanvasNode = ConfigCanvasNode;

/** Data on a decision node: the branch table of one function, drawn as a diamond. */
export interface DecisionNodeData {
  label: string;
  name: string;
  type: "decision";
  sourceNodeId: string;
  functionIndex: number;
  functionName: string;
  field: string;
  caseValues: string[];
  hasDefault: boolean;
  [key: string]: unknown;
}

export type DecisionCanvasNode = Node<DecisionNodeData, "decision">;
/** Everything React Flow draws: config nodes and the decision nodes derived from them. */
export type FlowCanvasNode = ConfigCanvasNode | DecisionCanvasNode;
export type CanvasNodeType = ConfigNodeType | "decision";

export function isConfigNode(node: FlowCanvasNode): node is ConfigCanvasNode {
  return node.type !== "decision";
}

export function isDecisionNode(node: FlowCanvasNode): node is DecisionCanvasNode {
  return node.type === "decision";
}

export function configNodesOf(nodes: ReadonlyArray<FlowCanvasNode>): CanvasNode[] {
  return nodes.filter(isConfigNode);
}

export type CanvasEdgeKind = "transition" | "branch" | "case" | "default";

/**
 * What an edge stands for in the config, so selection and deletion can find
 * the function entry without parsing ids. `kind` is `transition` for a
 * node-name destination, `branch` for the edge into a decision node, and
 * `case` or `default` for a row of a branch table leaving one.
 */
export interface CanvasEdgeData {
  sourceNodeId: string;
  /** Index of the function on the source node. Names can be empty or repeated mid-edit; indexes cannot. */
  functionIndex: number;
  kind: CanvasEdgeKind;
  caseValue?: string;
  /** Index of the case among the branch's cases, in config order. */
  caseIndex?: number;
  /** Among edges between the same two nodes, which this is and how many there are. */
  parallelIndex?: number;
  parallelCount?: number;
  /** Among edges into the same node, which this is, so their labels can stack. */
  inboundIndex?: number;
  inboundCount?: number;
  [key: string]: unknown;
}

export type CanvasEdge = Edge<CanvasEdgeData>;

/** The functions on a canvas node; none for a decision node. */
export function nodeFunctions(node: FlowCanvasNode | undefined): FlowConfigFunction[] {
  return node && isConfigNode(node) ? (node.data.functions ?? []) : [];
}

export interface Canvas {
  nodes: FlowCanvasNode[];
  edges: CanvasEdge[];
}

export interface ConfigToCanvasOptions {
  /** Stored positions, applied over the auto-layout for the nodes they cover. */
  positions?: NodePositions;
  layout?: LayoutOptions;
}

const ID_SEPARATOR = ":";

/** A card's one entry, at the top, and one exit, at the bottom. Decision nodes use the same two. */
export const IN_HANDLE = "in";
export const OUT_HANDLE = "out";

/** The arrowheads defined once in the shell, in the accent line and in the brand color. */
export const ARROW_MARKER = "url(#flow-arrow)";
export const ARROW_MARKER_SELECTED = "url(#flow-arrow-selected)";

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

/** The id of the decision node for a branch function; the index comes first so a name may hold the separator. */
export function decisionNodeId(sourceNodeId: string, functionIndex: number): string {
  return ["decision", functionIndex, sourceNodeId].join(ID_SEPARATOR);
}

export function parseDecisionNodeId(
  id: string
): { sourceNodeId: string; functionIndex: number } | null {
  const match = /^decision:(\d+):([\s\S]+)$/.exec(id);
  return match ? { sourceNodeId: match[2], functionIndex: Number(match[1]) } : null;
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
  const configNodes: CanvasNode[] = [];
  for (const [name, node] of Object.entries(config.nodes)) {
    const type = deriveConfigNodeType(name, node, config.initial_node);
    configNodes.push({
      id: name,
      type,
      position: { x: 0, y: 0 },
      data: { ...node, label: name, name, type },
    });
  }
  const nodes = withDecisionNodes(configNodes);
  return { nodes, edges: edgesForNodes(nodes) };
}

/** The decision nodes the config nodes' branch functions call for, placed under their sources. */
export function decisionNodesFor(configNodes: ReadonlyArray<CanvasNode>): DecisionCanvasNode[] {
  const decisions: DecisionCanvasNode[] = [];
  for (const node of configNodes) {
    (node.data.functions ?? []).forEach((fn, functionIndex) => {
      const transition = fn.transition_to;
      if (!isBranch(transition)) return;
      decisions.push({
        id: decisionNodeId(node.id, functionIndex),
        type: "decision",
        position: {
          x: node.position.x + NODE_CARD.width / 2 - DECISION.width / 2,
          y: node.position.y + (node.measured?.height ?? NODE_CARD.headerHeight) + DECISION.gap,
        },
        deletable: false,
        data: {
          label: transition.field,
          name: transition.field,
          type: "decision",
          sourceNodeId: node.id,
          functionIndex,
          functionName: fn.name,
          field: transition.field,
          caseValues: Object.keys(transition.cases),
          hasDefault: Boolean(transition.default),
        },
      });
    });
  }
  return decisions;
}

/**
 * The config nodes followed by their decision nodes. A decision node that was
 * already on the canvas keeps its position, selection, and measurements;
 * a new one is placed under its source until the next layout.
 */
export function withDecisionNodes(
  configNodes: ReadonlyArray<CanvasNode>,
  previous: ReadonlyArray<FlowCanvasNode> = []
): FlowCanvasNode[] {
  const existing = new Map(previous.filter(isDecisionNode).map((node) => [node.id, node]));
  const decisions = decisionNodesFor(configNodes).map((decision) => {
    const before = existing.get(decision.id);
    return before ? { ...before, data: decision.data } : decision;
  });
  return [...configNodes, ...decisions];
}

/**
 * The nodes with their decision nodes brought in step with the config nodes.
 * Returns the same array when nothing about the decisions changed, so a
 * state update can be skipped.
 */
export function reconcileDecisionNodes(nodes: FlowCanvasNode[]): FlowCanvasNode[] {
  const next = withDecisionNodes(configNodesOf(nodes), nodes);
  const current = nodes.filter(isDecisionNode);
  const derived = next.filter(isDecisionNode);
  const same =
    current.length === derived.length &&
    current.every(
      (node, i) => node.id === derived[i].id && sameDecision(node.data, derived[i].data)
    ) &&
    nodes.every((node, i) => next[i].id === node.id);
  return same ? nodes : next;
}

function sameDecision(a: DecisionNodeData, b: DecisionNodeData): boolean {
  return (
    a.functionName === b.functionName &&
    a.field === b.field &&
    a.hasDefault === b.hasDefault &&
    a.caseValues.length === b.caseValues.length &&
    a.caseValues.every((value, i) => value === b.caseValues[i])
  );
}

/** The edges the nodes' function entries call for. */
export function edgesForNodes(nodes: ReadonlyArray<FlowCanvasNode>): CanvasEdge[] {
  const edges: CanvasEdge[] = [];
  for (const node of configNodesOf(nodes)) {
    (node.data.functions ?? []).forEach((fn, functionIndex) => {
      const transition = fn.transition_to;
      if (transition === undefined || transition === null) return;
      if (isBranch(transition)) {
        edges.push(...branchEdges(node.id, functionIndex, fn.name, transition));
      } else {
        edges.push(transitionEdge(node.id, functionIndex, fn.name, transition));
      }
    });
  }
  return markFanning(edges);
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
  source: string,
  target: string,
  label: string,
  data: CanvasEdgeData
): CanvasEdge {
  return {
    id,
    source,
    sourceHandle: OUT_HANDLE,
    target,
    targetHandle: IN_HANDLE,
    type: source === target ? "selfloop" : "labeled",
    label,
    markerEnd: ARROW_MARKER,
    data,
  };
}

function transitionEdge(
  sourceNodeId: string,
  functionIndex: number,
  name: string,
  target: string
): CanvasEdge {
  return edge(transitionEdgeId(sourceNodeId, functionIndex), sourceNodeId, target, name, {
    sourceNodeId,
    functionIndex,
    kind: "transition",
  });
}

function branchEdges(
  sourceNodeId: string,
  functionIndex: number,
  name: string,
  branch: FlowConfigBranch
): CanvasEdge[] {
  const decision = decisionNodeId(sourceNodeId, functionIndex);
  const edges = [
    edge(transitionEdgeId(sourceNodeId, functionIndex), sourceNodeId, decision, name, {
      sourceNodeId,
      functionIndex,
      kind: "branch",
    }),
    ...Object.entries(branch.cases).map(([caseValue, target], caseIndex) =>
      edge(branchCaseEdgeId(sourceNodeId, functionIndex, caseValue), decision, target, caseValue, {
        sourceNodeId,
        functionIndex,
        kind: "case",
        caseValue,
        caseIndex,
      })
    ),
  ];
  if (branch.default) {
    edges.push(
      edge(branchDefaultEdgeId(sourceNodeId, functionIndex), decision, branch.default, "default", {
        sourceNodeId,
        functionIndex,
        kind: "default",
      })
    );
  }
  return edges;
}

/**
 * Numbers the edges that share a source and target, so they can be drawn
 * apart, and the edges that share a target, so their labels can stack
 * above its entry.
 */
function markFanning(edges: CanvasEdge[]): CanvasEdge[] {
  const parallel = new Map<string, CanvasEdge[]>();
  const inbound = new Map<string, CanvasEdge[]>();
  for (const e of edges) {
    const key = `${e.source} -> ${e.target}`;
    parallel.set(key, [...(parallel.get(key) ?? []), e]);
    if (e.source !== e.target) inbound.set(e.target, [...(inbound.get(e.target) ?? []), e]);
  }
  for (const group of parallel.values()) {
    if (group.length < 2) continue;
    group.forEach((e, i) => {
      e.data = { ...e.data!, parallelIndex: i, parallelCount: group.length };
    });
  }
  for (const group of inbound.values()) {
    if (group.length < 2) continue;
    group.forEach((e, i) => {
      e.data = { ...e.data!, inboundIndex: i, inboundCount: group.length };
    });
  }
  return edges;
}
