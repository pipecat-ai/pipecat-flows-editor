import { useEffect } from "react";
import type { Node } from "reactflow";

import type { FlowFunctionJson } from "@/lib/schema/flow.schema";
import {
  generateDecisionNodeId,
  getDecisionNodeData,
  parseDecisionNodeId,
} from "@/lib/utils/decisionNodes";

/**
 * Hook to manage decision nodes lifecycle
 * Creates, updates, and removes decision nodes based on function decisions
 */
export function useDecisionNodes(
  nodes: Node[],
  setNodes: (updater: (nodes: Node[]) => Node[]) => void
) {
  useEffect(() => {
    const regularNodes = nodes.filter((n) => n.type !== "decision");
    const validDecisionIds = new Set<string>();
    const decisionNodesToCreate: Node[] = [];
    const decisionNodesToUpdate = new Map<string, Node>();

    // Collect decision nodes that should exist
    regularNodes.forEach((node) => {
      const functions = ((node.data as any)?.functions as FlowFunctionJson[] | undefined) ?? [];
      functions.forEach((func) => {
        if (func.decision) {
          const decisionNodeId = generateDecisionNodeId(node.id, func.name);
          validDecisionIds.add(decisionNodeId);

          const existingNode = nodes.find((n) => n.id === decisionNodeId);
          if (!existingNode) {
            // Create new decision node
            const decisionData = getDecisionNodeData(node.id, node.position, func);
            decisionNodesToCreate.push({
              id: decisionData.id,
              type: "decision",
              position: decisionData.position,
              data: decisionData.data,
            } as Node);
          } else {
            // Update existing decision node if data changed
            const newData = getDecisionNodeData(node.id, node.position, func).data;
            if (
              existingNode.data.label !== newData.label ||
              existingNode.data.action !== newData.action ||
              existingNode.data.conditionCount !== newData.conditionCount ||
              existingNode.data.sourceNodeId !== newData.sourceNodeId ||
              existingNode.data.functionName !== newData.functionName
            ) {
              decisionNodesToUpdate.set(decisionNodeId, {
                ...existingNode,
                data: newData,
              } as Node);
            }
          }
        }
      });
    });

    // Update nodes if needed
    const hasOrphanedNodes = nodes.some(
      (n) => n.type === "decision" && !validDecisionIds.has(n.id)
    );

    if (decisionNodesToCreate.length > 0 || decisionNodesToUpdate.size > 0 || hasOrphanedNodes) {
      setNodes((nds) => {
        // Remove orphaned decision nodes
        let filtered = nds.filter((n) => {
          if (n.type === "decision") {
            return validDecisionIds.has(n.id);
          }
          return true;
        });

        // Update existing decision nodes
        filtered = filtered.map((n) => {
          if (n.type === "decision" && decisionNodesToUpdate.has(n.id)) {
            return decisionNodesToUpdate.get(n.id)!;
          }
          return n;
        });

        // Add new decision nodes
        decisionNodesToCreate.forEach((newNode) => {
          if (!filtered.some((n) => n.id === newNode.id)) {
            filtered = [...filtered, newNode];
          }
        });

        return filtered;
      });
    }
  }, [nodes, setNodes]);
}

/**
 * Extract decision node info from position change
 */
export function extractDecisionNodeFromChange(
  change: { id: string; position?: { x: number; y: number } },
  nodes: Node[]
): { sourceNodeId: string; functionName: string; position: { x: number; y: number } } | null {
  const node = nodes.find((n) => n.id === change.id);
  if (!node || node.type !== "decision" || !change.position) return null;

  const parsed = parseDecisionNodeId(node.id);
  if (!parsed) return null;

  return {
    sourceNodeId: parsed.sourceNodeId,
    functionName: parsed.functionName,
    position: change.position,
  };
}
