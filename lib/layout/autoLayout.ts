/**
 * Auto-layout for a freshly opened flow. Positions are not part of the
 * document, so a config with no stored positions is laid out with dagre;
 * see `lib/storage/positionStore.ts` for what happens after that.
 */

import dagre from "@dagrejs/dagre";
import type { Edge, Node } from "@xyflow/react";

export type LayoutDirection = "TB" | "LR";

export interface LayoutOptions {
  /** Rank direction. Nodes connect top to bottom, so "TB" is the default. */
  direction?: LayoutDirection;
  /** Horizontal gap between nodes in the same rank. */
  nodeSpacing?: number;
  /** Vertical gap between ranks. */
  rankSpacing?: number;
  /** Size estimate for a node that has not been measured yet. */
  measure?: (node: Node) => { width: number; height: number };
}

export const BRANCH_NODE_SIZE = { width: 150, height: 52 };

/**
 * Estimates a node's rendered size from its label. React Flow measures nodes
 * after mount, but layout runs before that, on data alone.
 */
export function estimateNodeSize(node: Node): { width: number; height: number } {
  if (node.type === "decision") return BRANCH_NODE_SIZE;
  const label = String(node.data?.label ?? node.id);
  return { width: Math.max(80, 28 + label.length * 7), height: 32 };
}

/** Returns copies of `nodes` with dagre-assigned positions. Edges are unchanged. */
export function layoutNodes<N extends Node>(
  nodes: N[],
  edges: Edge[],
  options: LayoutOptions = {}
): N[] {
  const {
    direction = "TB",
    nodeSpacing = 48,
    rankSpacing = 64,
    measure = estimateNodeSize,
  } = options;

  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ rankdir: direction, nodesep: nodeSpacing, ranksep: rankSpacing });
  graph.setDefaultEdgeLabel(() => ({}));

  const sizes = new Map<string, { width: number; height: number }>();
  for (const node of nodes) {
    const size =
      node.measured?.width && node.measured?.height
        ? { width: node.measured.width, height: node.measured.height }
        : measure(node);
    sizes.set(node.id, size);
    graph.setNode(node.id, size);
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
    // dagre reports centers; React Flow positions are top-left corners.
    return {
      ...node,
      position: { x: placed.x - size.width / 2, y: placed.y - size.height / 2 },
    };
  });
}
