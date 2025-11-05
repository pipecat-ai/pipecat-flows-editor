import type { Edge, Node } from "reactflow";

import type { FlowFunctionJson } from "@/lib/schema/flow.schema";

import { generateDecisionNodeId } from "./decisionNodes";

/**
 * Derive all edges from node functions
 */
export function deriveEdgesFromNodes(nodes: Node[]): Edge[] {
  const edges: Edge[] = [];
  const regularNodes = nodes.filter((n) => n.type !== "decision");

  regularNodes.forEach((node) => {
    const functions = ((node.data as any)?.functions as FlowFunctionJson[] | undefined) ?? [];
    functions.forEach((func) => {
      if (func.decision) {
        const decisionNodeId = generateDecisionNodeId(node.id, func.name);

        // Edge from source to decision node (no label)
        edges.push({
          id: `edge-${node.id}-${decisionNodeId}`,
          source: node.id,
          target: decisionNodeId,
          label: undefined,
          type: "default",
          selected: false,
          style: undefined,
        });

        // Edges from decision node to condition targets
        func.decision.conditions.forEach((condition, index) => {
          const conditionLabel = `result ${condition.operator} ${condition.value}`;
          edges.push({
            id: `edge-${decisionNodeId}-cond-${index}-${condition.next_node_id}`,
            source: decisionNodeId,
            target: condition.next_node_id,
            label: conditionLabel,
            type: "default",
            selected: false,
            style: undefined,
          });
        });

        // Edge from decision node to default target
        edges.push({
          id: `edge-${decisionNodeId}-default-${func.decision.default_next_node_id}`,
          source: decisionNodeId,
          target: func.decision.default_next_node_id,
          label: "default",
          type: "default",
          selected: false,
          style: undefined,
        });
      } else if (func.next_node_id && func.name) {
        // Simple next_node_id edge
        edges.push({
          id: `func-${node.id}-${func.name}-${func.next_node_id}`,
          source: node.id,
          target: func.next_node_id,
          label: func.name,
          type: "default",
          selected: false,
          style: undefined,
        });
      }
    });
  });

  return edges;
}

/**
 * Check if edges have changed (structure or properties)
 */
export function edgesChanged(
  currentEdges: Edge[],
  derivedEdges: Edge[]
): { changed: boolean; newEdges: Edge[] } {
  // Quick check: if lengths differ, structure changed
  if (currentEdges.length !== derivedEdges.length) {
    return { changed: true, newEdges: derivedEdges };
  }

  // Check if any edge was added or removed
  const currentIds = new Set(currentEdges.map((e) => e.id));
  const derivedIds = new Set(derivedEdges.map((e) => e.id));

  if (currentIds.size !== derivedIds.size || ![...currentIds].every((id) => derivedIds.has(id))) {
    return { changed: true, newEdges: derivedEdges };
  }

  // Check if any edge properties changed (e.g., label, target)
  const hasChanged = derivedEdges.some((derivedEdge) => {
    const currentEdge = currentEdges.find((e) => e.id === derivedEdge.id);
    if (!currentEdge) return true;

    return (
      currentEdge.label !== derivedEdge.label ||
      currentEdge.target !== derivedEdge.target ||
      currentEdge.source !== derivedEdge.source
    );
  });

  if (hasChanged) {
    // Merge selection state from current edges into new edges
    const newEdges = derivedEdges.map((derivedEdge) => {
      const currentEdge = currentEdges.find((e) => e.id === derivedEdge.id);
      return currentEdge ? { ...derivedEdge, selected: currentEdge.selected } : derivedEdge;
    });
    return { changed: true, newEdges };
  }

  return { changed: false, newEdges: currentEdges };
}
