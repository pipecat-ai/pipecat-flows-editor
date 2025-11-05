import type { Edge, Node } from "reactflow";

import type { FlowFunctionJson, FlowJson } from "@/lib/schema/flow.schema";
import { deriveNodeType } from "@/lib/utils/nodeType";

export function reactFlowToFlowJson(nodes: Node[], edges: Edge[]): FlowJson {
  // Edges are now derived ONLY from function.next_node_id mappings
  // The edges parameter is ignored - edges are visualization-only
  // Decision nodes are filtered out - they're visualization-only
  const functionEdges: Array<{ id: string; source: string; target: string; label?: string }> = [];
  const regularNodes = nodes.filter((n) => n.type !== "decision");
  const decisionNodes = nodes.filter((n) => n.type === "decision");

  // Create a map of decision node IDs to their positions
  const decisionNodePositions = new Map<string, { x: number; y: number }>();
  decisionNodes.forEach((dn) => {
    decisionNodePositions.set(dn.id, {
      x: dn.position.x,
      y: dn.position.y,
    });
  });

  regularNodes.forEach((node) => {
    const functions = (node.data?.functions as FlowFunctionJson[] | undefined) ?? [];
    functions.forEach((func) => {
      // If function has decision, edges are derived from decision conditions + default
      // Otherwise, use simple next_node_id
      if (func.decision) {
        // Decision edges are already represented in the decision structure
        // We don't need to create edges here - the decision object contains all routing info

        // Capture decision node position if it exists
        const decisionNodeId = `decision-${node.id}-${func.name}`;
        const position = decisionNodePositions.get(decisionNodeId);
        if (position) {
          // Update the function's decision with the position
          (func as any).decision = {
            ...func.decision,
            decision_node_position: position,
          };
        }
      } else if (func.next_node_id) {
        functionEdges.push({
          id: `func-${node.id}-${func.name}-${func.next_node_id}`,
          source: node.id,
          target: func.next_node_id,
          label: func.name,
        });
      }
    });
  });

  return {
    $id: "https://flows.pipecat.ai/schema/flow.json",
    meta: { name: "Untitled", version: "0.1.0" },
    nodes: regularNodes.map((n) => ({
      id: n.id,
      type: deriveNodeType(n.data, n.type as string),
      position: n.position,
      data: n.data ?? {},
    })),
    edges: functionEdges, // Edges are derived from functions only
    global_functions: undefined, // TODO: Add UI for global functions
  } as FlowJson;
}

export function flowJsonToReactFlow(flow: FlowJson): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // First, create regular nodes
  flow.nodes.forEach((n) => {
    // Derive type from data (especially post_actions)
    const derivedType = deriveNodeType(n.data, n.type);
    nodes.push({
      id: n.id,
      type: derivedType as any,
      position: n.position as any,
      data: { ...n.data, type: derivedType }, // Preserve derived type in data for React Flow
    });
  });

  // Then, derive edges and decision nodes from functions
  flow.nodes.forEach((node) => {
    const functions = (node.data?.functions as FlowFunctionJson[] | undefined) ?? [];
    functions.forEach((func) => {
      if (func.decision) {
        // Create decision node
        const decisionNodeId = `decision-${node.id}-${func.name}`;
        // Use saved position if available, otherwise default to below source node
        const savedPosition = func.decision.decision_node_position;
        const position = savedPosition
          ? { x: savedPosition.x, y: savedPosition.y }
          : {
              x: (node.position as any).x,
              y: (node.position as any).y + 150,
            };
        const decisionNode: Node = {
          id: decisionNodeId,
          type: "decision",
          position,
          data: {
            label: func.name,
            action: func.decision.action,
            conditionCount: func.decision.conditions.length,
          },
        };
        nodes.push(decisionNode);

        // Create edge from source to decision node
        edges.push({
          id: `edge-${node.id}-${decisionNodeId}`,
          source: node.id,
          target: decisionNodeId,
          label: func.name,
        } as Edge);

        // Create edges from decision node to condition targets
        func.decision.conditions.forEach((condition, index) => {
          const conditionLabel = `result ${condition.operator} ${condition.value}`;
          edges.push({
            id: `edge-${decisionNodeId}-cond-${index}-${condition.next_node_id}`,
            source: decisionNodeId,
            target: condition.next_node_id,
            label: conditionLabel,
          } as Edge);
        });

        // Create edge from decision node to default target
        edges.push({
          id: `edge-${decisionNodeId}-default-${func.decision.default_next_node_id}`,
          source: decisionNodeId,
          target: func.decision.default_next_node_id,
          label: "default",
        } as Edge);
      } else if (func.next_node_id) {
        // Simple next_node_id edge
        edges.push({
          id: `func-${node.id}-${func.name}-${func.next_node_id}`,
          source: node.id,
          target: func.next_node_id!,
          label: func.name,
        } as Edge);
      }
    });
  });

  return { nodes, edges };
}
