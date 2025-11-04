import type { Edge, Node } from "reactflow";
import type { FlowJson, FlowFunctionJson } from "@/lib/schema/flow.schema";
import { deriveNodeType } from "@/lib/utils/nodeType";

export function reactFlowToFlowJson(nodes: Node[], edges: Edge[]): FlowJson {
  // Edges are now derived ONLY from function.next_node_id mappings
  // The edges parameter is ignored - edges are visualization-only
  const functionEdges: Array<{ id: string; source: string; target: string; label?: string }> = [];
  nodes.forEach((node) => {
    const functions = (node.data?.functions as FlowFunctionJson[] | undefined) ?? [];
    functions.forEach((func) => {
      if (func.next_node_id) {
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
    nodes: nodes.map((n) => ({
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
  const nodes = flow.nodes.map((n) => {
    // Derive type from data (especially post_actions)
    const derivedType = deriveNodeType(n.data, n.type);
    return {
      id: n.id,
      type: derivedType as any,
      position: n.position as any,
      data: { ...n.data, type: derivedType }, // Preserve derived type in data for React Flow
    };
  });

  // Edges are derived ONLY from function.next_node_id (for visualization)
  // Ignore any explicit edges in the JSON - they're deprecated
  const edges: Edge[] = [];
  flow.nodes.forEach((node) => {
    const functions = (node.data?.functions as FlowFunctionJson[] | undefined) ?? [];
    functions.forEach((func) => {
      if (func.next_node_id) {
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
