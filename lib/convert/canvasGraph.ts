/**
 * Keeps the edges in step with the nodes. Every edge is a function of the
 * nodes' function entries, so after any edit they are recomputed and
 * reconciled with what is on the canvas.
 */

import { type CanvasEdge, type CanvasNode, edgesForNodes } from "./configToCanvas";

export function deriveCanvasEdges(nodes: CanvasNode[]): CanvasEdge[] {
  return edgesForNodes(nodes);
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
      existing.sourceHandle !== edge.sourceHandle ||
      existing.target !== edge.target
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
