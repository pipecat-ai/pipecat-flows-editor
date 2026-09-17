/**
 * Auto-layout for a freshly opened flow. Positions are not part of the
 * document, so a config with no stored positions is laid out with dagre,
 * top to bottom, the way a conversation is read: edges leave a card's
 * bottom and enter the next card's top, and a branch's decision node sits
 * between its source and its targets, and the routes it gives the edges
 * stretch with the nodes when they are moved by hand. See
 * `lib/storage/positionStore.ts` for what happens after that.
 */

import dagre from "@dagrejs/dagre";
import type { Edge, Node } from "@xyflow/react";

import type { CanvasEdgeData, ConfigNodeData } from "@/lib/convert/configToCanvas";
import type { FlowConfigFunction } from "@/lib/schema/flowConfig";
import { cardActionLines } from "@/lib/utils/actionSummary";

export type LayoutDirection = "TB" | "LR";

export interface LayoutOptions {
  /** Rank direction. Edges leave a card's bottom and enter a card's top, so "TB" is the default. */
  direction?: LayoutDirection;
  /** Gap between nodes in the same rank. */
  nodeSpacing?: number;
  /** Gap between ranks, before edge labels ask for more. */
  rankSpacing?: number;
  /** Size estimate for a node that has not been measured yet. */
  measure?: (node: Node) => { width: number; height: number };
}

/** The node card's geometry, shared with the size estimate so layout matches rendering. */
export const NODE_CARD = {
  width: 280,
  headerHeight: 36,
  rowHeight: 24,
  padding: 8,
  /** Two muted lines of the node's first task message under its name. */
  descriptionHeight: 40,
};

/** An end node with nothing but the end: a small pill rather than a card. */
export const COMPACT_END = { width: 160, height: 36 };

/** The decision node's geometry: a flat diamond with the field inside, and its distance under a new source. */
export const DECISION = { width: 120, height: 44, gap: 48 };

/** An edge label's pill: its height, the width per character, the glyph and padding, and how many characters it shows. */
export const EDGE_LABEL = { height: 20, charWidth: 6.6, padding: 30, maxChars: 28 };

/** How wide an edge label's pill is, from its text. */
export function edgeLabelWidth(text: string): number {
  const chars = Math.min(text.length, EDGE_LABEL.maxChars);
  return Math.max(24, chars * EDGE_LABEL.charWidth + EDGE_LABEL.padding);
}

/** How far right of a card the run of a loop around it sits, so the label on the run clears the card. */
export function loopClearance(text: string): number {
  return edgeLabelWidth(text) / 2 + 16;
}

/** How much each further loop around the same card steps outward. */
export const LOOP_STEP = 14;

/** The card's description: the node's first task message, on one line, or nothing. */
export function cardDescription(data: Pick<ConfigNodeData, "task_messages">): string {
  const content = data.task_messages?.[0]?.content;
  return typeof content === "string" ? content.replace(/\s+/g, " ").trim() : "";
}

/**
 * Whether an end node is drawn as a small pill: it ends the conversation and
 * has nothing else to show, no message, no function, no other action.
 */
export function isCompactEnd(type: string | undefined, data: ConfigNodeData): boolean {
  if (type !== "end") return false;
  if (cardDescription(data) || (data.functions ?? []).length > 0) return false;
  const actions = [...(data.pre_actions ?? []), ...(data.post_actions ?? [])];
  return actions.every((action) => action.type === "end_conversation");
}

/** How many rows a node card shows: one per function that stays on the node. */
export function nodeRowCount(node: Node): number {
  const functions = (node.data?.functions as FlowConfigFunction[] | undefined) ?? [];
  return functions.filter((fn) => fn.transition_to === undefined || fn.transition_to === null)
    .length;
}

/**
 * Estimates a node's rendered size from its data. React Flow measures nodes
 * after mount, but layout runs before that, on data alone.
 */
export function estimateNodeSize(node: Node): { width: number; height: number } {
  if (node.type === "decision") return { width: DECISION.width, height: DECISION.height };
  if (node.type === "global") {
    const rows = ((node.data?.functions as FlowConfigFunction[] | undefined) ?? []).length;
    return {
      width: NODE_CARD.width,
      height: NODE_CARD.headerHeight + rows * NODE_CARD.rowHeight + NODE_CARD.padding,
    };
  }
  const data = node.data as ConfigNodeData;
  if (isCompactEnd(node.type, data)) return { ...COMPACT_END };
  const rows = nodeRowCount(node);
  const { before, after } = cardActionLines(data);
  const block = (count: number) =>
    count * NODE_CARD.rowHeight + (count > 0 ? NODE_CARD.padding : 0);
  const description = cardDescription(data) ? NODE_CARD.descriptionHeight : 0;
  return {
    width: NODE_CARD.width,
    height:
      NODE_CARD.headerHeight +
      description +
      block(before.length) +
      block(rows) +
      block(after.length),
  };
}

function labelText(edge: Edge): string {
  return typeof edge.label === "string" ? edge.label : "";
}

/**
 * How the layout routed an edge: the points it runs through, from the
 * source's border, past the nodes in between, to the target's border, the
 * slot it reserved for the label, and where its endpoints were placed, so
 * the route can stretch with the endpoints when they are moved by hand.
 */
export interface EdgeRoute {
  points: Array<{ x: number; y: number }>;
  label?: { x: number; y: number };
  source: { x: number; y: number };
  target: { x: number; y: number };
  /** The nodes the route joins. Edge ids are reused after an edit, so an edge takes a route only between the same nodes. */
  sourceNodeId: string;
  targetNodeId: string;
}

export type EdgeRoutes = Record<string, EdgeRoute>;

/** Returns copies of `nodes` with dagre-assigned positions. Edges are unchanged. */
export function layoutNodes<N extends Node>(
  nodes: N[],
  edges: Edge[],
  options: LayoutOptions = {}
): N[] {
  return layoutGraph(nodes, edges, options).nodes;
}

/** Lays the nodes out and keeps how each edge was routed between them. */
export function layoutGraph<N extends Node>(
  nodes: N[],
  edges: Edge[],
  options: LayoutOptions = {}
): { nodes: N[]; routes: EdgeRoutes } {
  const {
    direction = "TB",
    nodeSpacing = 56,
    rankSpacing = 140,
    measure = estimateNodeSize,
  } = options;

  const graph = new dagre.graphlib.Graph({ multigraph: true });
  graph.setGraph({ rankdir: direction, nodesep: nodeSpacing, ranksep: rankSpacing, edgesep: 24 });
  graph.setDefaultEdgeLabel(() => ({}));

  // A loop around a card, a self-loop or a case back to its own node, runs
  // up the card's right side with its label on the run, so the card gets
  // room for the widest label, and for each further loop outward. The room
  // is added on both sides so the card stays centered on its column.
  const loopRoom = new Map<string, number>();
  const loopCount = new Map<string, number>();
  for (const edge of edges) {
    const around =
      edge.source === edge.target
        ? edge.source
        : (edge.data as CanvasEdgeData | undefined)?.sourceNodeId === edge.target
          ? edge.target
          : null;
    if (!around) continue;
    const text = labelText(edge);
    const room = loopClearance(text) + edgeLabelWidth(text) / 2 + 8;
    loopRoom.set(around, Math.max(loopRoom.get(around) ?? 0, room));
    loopCount.set(around, (loopCount.get(around) ?? 0) + 1);
  }
  const sizes = new Map<string, { width: number; height: number }>();
  for (const node of nodes) {
    const size =
      node.measured?.width && node.measured?.height
        ? { width: node.measured.width, height: node.measured.height }
        : measure(node);
    const sideroom = loopRoom.has(node.id)
      ? loopRoom.get(node.id)! + (loopCount.get(node.id)! - 1) * LOOP_STEP
      : 0;
    sizes.set(node.id, size);
    graph.setNode(node.id, { width: size.width + 2 * sideroom, height: size.height });
  }
  for (const edge of edges) {
    // Self-loops carry no layout information and dagre handles them poorly;
    // nor does a case that leads back to its own branch's node, drawn as a loop.
    if (edge.source === edge.target) continue;
    if ((edge.data as CanvasEdgeData | undefined)?.sourceNodeId === edge.target) continue;
    if (!sizes.has(edge.source) || !sizes.has(edge.target)) continue;
    // The label's footprint keeps ranks far enough apart to read it.
    graph.setEdge(
      edge.source,
      edge.target,
      { width: edgeLabelWidth(labelText(edge)), height: EDGE_LABEL.height, labelpos: "c" },
      edge.id
    );
  }

  dagre.layout(graph);

  const placedNodes = nodes.map((node) => {
    const placed = graph.node(node.id);
    const size = sizes.get(node.id)!;
    // dagre reports centers; React Flow positions are top-left corners
    return {
      ...node,
      position: { x: placed.x - size.width / 2, y: placed.y - size.height / 2 },
    };
  });
  const positions = new Map(placedNodes.map((node) => [node.id, node.position]));

  const routes: EdgeRoutes = {};
  for (const edge of edges) {
    const routed = graph.edge({ v: edge.source, w: edge.target, name: edge.id });
    const source = positions.get(edge.source);
    const target = positions.get(edge.target);
    if (!routed || !source || !target) continue;
    const points = (routed.points ?? []).map((p: { x: number; y: number }) => ({ x: p.x, y: p.y }));
    routes[edge.id] = {
      points,
      ...(typeof routed.x === "number" && typeof routed.y === "number"
        ? { label: { x: routed.x, y: routed.y } }
        : {}),
      source: { ...source },
      target: { ...target },
      sourceNodeId: edge.source,
      targetNodeId: edge.target,
    };
  }

  return { nodes: placedNodes, routes };
}
