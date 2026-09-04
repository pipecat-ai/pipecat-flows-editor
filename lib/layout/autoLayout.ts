/**
 * Auto-layout for a freshly opened flow. Positions are not part of the
 * document, so a config with no stored positions is laid out with dagre,
 * left to right, the way edges run from a row's port to the next card;
 * see `lib/storage/positionStore.ts` for what happens after that.
 */

import dagre from "@dagrejs/dagre";
import type { Edge, Node } from "@xyflow/react";

import { type FlowConfigFunction, isBranch } from "@/lib/schema/flowConfig";

export type LayoutDirection = "TB" | "LR";

export interface LayoutOptions {
  /** Rank direction. Edges leave a row's right side and enter a card's left, so "LR" is the default. */
  direction?: LayoutDirection;
  /** Horizontal gap between nodes in the same rank. */
  nodeSpacing?: number;
  /** Vertical gap between ranks. */
  rankSpacing?: number;
  /** Size estimate for a node that has not been measured yet. */
  measure?: (node: Node) => { width: number; height: number };
}

/** Space reserved above a card with a self-loop, for the loop's arc. */
export const SELF_LOOP_HEADROOM = 36;

/** The node card's geometry, shared with the size estimate so layout matches rendering. */
export const NODE_CARD = { minWidth: 220, headerHeight: 36, rowHeight: 24, padding: 8 };

/** How many rows a node card shows: one per function, plus one per case and default of a branch. */
export function nodeRowCount(node: Node): number {
  const functions = (node.data?.functions as FlowConfigFunction[] | undefined) ?? [];
  return functions.reduce((count, fn) => {
    if (!isBranch(fn.transition_to)) return count + 1;
    const cases = Object.keys(fn.transition_to.cases).length;
    return count + 1 + cases + (fn.transition_to.default ? 1 : 0) + 1; // + "add case" row
  }, 0);
}

/**
 * Estimates a node's rendered size from its rows. React Flow measures nodes
 * after mount, but layout runs before that, on data alone.
 */
export function estimateNodeSize(node: Node): { width: number; height: number } {
  const rows = nodeRowCount(node);
  return {
    width: NODE_CARD.minWidth,
    height:
      NODE_CARD.headerHeight + rows * NODE_CARD.rowHeight + (rows > 0 ? NODE_CARD.padding : 0),
  };
}

/** Returns copies of `nodes` with dagre-assigned positions. Edges are unchanged. */
export function layoutNodes<N extends Node>(
  nodes: N[],
  edges: Edge[],
  options: LayoutOptions = {}
): N[] {
  const {
    direction = "LR",
    nodeSpacing = 56,
    rankSpacing = 140,
    measure = estimateNodeSize,
  } = options;

  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ rankdir: direction, nodesep: nodeSpacing, ranksep: rankSpacing });
  graph.setDefaultEdgeLabel(() => ({}));

  // A self-loop arcs over its card, so the card gets headroom in the layout
  const loops = new Set(edges.filter((e) => e.source === e.target).map((e) => e.source));
  const sizes = new Map<string, { width: number; height: number }>();
  for (const node of nodes) {
    const size =
      node.measured?.width && node.measured?.height
        ? { width: node.measured.width, height: node.measured.height }
        : measure(node);
    const headroom = loops.has(node.id) ? SELF_LOOP_HEADROOM : 0;
    sizes.set(node.id, { width: size.width, height: size.height + headroom });
    graph.setNode(node.id, { width: size.width, height: size.height + headroom });
  }
  for (const edge of edges) {
    // Self-loops carry no layout information and dagre handles them poorly.
    if (edge.source === edge.target) continue;
    if (!sizes.has(edge.source) || !sizes.has(edge.target)) continue;
    graph.setEdge(edge.source, edge.target);
  }

  dagre.layout(graph);

  return nodes.map((node) => {
    const placed = graph.node(node.id);
    const size = sizes.get(node.id)!;
    const headroom = loops.has(node.id) ? SELF_LOOP_HEADROOM : 0;
    // dagre reports centers; React Flow positions are top-left corners. The
    // headroom sits above the card, so the card moves down inside its box.
    return {
      ...node,
      position: { x: placed.x - size.width / 2, y: placed.y - size.height / 2 + headroom },
    };
  });
}
