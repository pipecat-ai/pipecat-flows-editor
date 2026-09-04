/**
 * Keeps the derived parts of the canvas in step with the config nodes. Branch
 * nodes and every edge are a function of the config nodes' function entries,
 * so after any edit they are recomputed from the nodes and reconciled with
 * what is on the canvas, keeping existing branch nodes' positions.
 */

import { canvasToConfig } from "./canvasToConfig";
import {
  type BranchCanvasNode,
  type CanvasEdge,
  type CanvasNode,
  configToGraph,
  isBranchNode,
  isConfigNode,
} from "./configToCanvas";

const NEW_BRANCH_NODE_OFFSET = { x: 0, y: 100 };

export interface DerivedCanvas {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  /** True when a branch node was added, removed, or updated. */
  nodesChanged: boolean;
}

export function deriveCanvasGraph(nodes: CanvasNode[]): DerivedCanvas {
  const configNodes = nodes.filter(isConfigNode);
  const derived = configToGraph(canvasToConfig(configNodes));
  const wanted = new Map(derived.nodes.filter(isBranchNode).map((node) => [node.id, node]));
  const existing = new Map(nodes.filter(isBranchNode).map((node) => [node.id, node]));

  let nodesChanged = false;
  const result: CanvasNode[] = [];

  for (const node of nodes) {
    if (isConfigNode(node)) {
      result.push(node);
      continue;
    }
    const target = wanted.get(node.id);
    if (!target) {
      nodesChanged = true;
      continue;
    }
    if (sameBranchData(node, target)) {
      result.push(node);
    } else {
      nodesChanged = true;
      result.push({ ...node, data: target.data });
    }
  }

  for (const [id, node] of wanted) {
    if (existing.has(id)) continue;
    nodesChanged = true;
    const source = configNodes.find((n) => n.id === node.data.sourceNodeId);
    const position = source
      ? {
          x: source.position.x + NEW_BRANCH_NODE_OFFSET.x,
          y: source.position.y + (source.measured?.height ?? 0) + NEW_BRANCH_NODE_OFFSET.y,
        }
      : node.position;
    result.push({ ...node, position });
  }

  return { nodes: result, edges: derived.edges, nodesChanged };
}

function sameBranchData(a: BranchCanvasNode, b: BranchCanvasNode): boolean {
  return (
    a.data.label === b.data.label &&
    a.data.sourceNodeId === b.data.sourceNodeId &&
    a.data.functionName === b.data.functionName &&
    a.data.field === b.data.field &&
    a.data.caseCount === b.data.caseCount &&
    a.data.hasDefault === b.data.hasDefault
  );
}

/**
 * Reconciles derived edges with the canvas edges, returning the canvas edges
 * untouched when nothing changed so React Flow does not re-render, and
 * carrying selection state over when something did.
 */
export function reconcileEdges(
  current: CanvasEdge[],
  derived: CanvasEdge[]
): { changed: boolean; edges: CanvasEdge[] } {
  if (current.length !== derived.length) return { changed: true, edges: derived };
  const byId = new Map(current.map((edge) => [edge.id, edge]));
  const changed = derived.some((edge) => {
    const existing = byId.get(edge.id);
    return (
      !existing ||
      existing.source !== edge.source ||
      existing.target !== edge.target ||
      existing.label !== edge.label
    );
  });
  if (!changed) return { changed: false, edges: current };
  return {
    changed: true,
    edges: derived.map((edge) => {
      const existing = byId.get(edge.id);
      return existing ? { ...edge, selected: existing.selected } : edge;
    }),
  };
}
