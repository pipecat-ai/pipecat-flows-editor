import type { Connection } from "@xyflow/react";

import {
  type CanvasNode,
  isBranchNode,
  nodeFunctions,
  parseBranchNodeId,
} from "@/lib/convert/configToCanvas";
import { type FlowConfigFunction, isBranch } from "@/lib/schema/flowConfig";
import { addCase } from "@/lib/utils/branchEdits";
import { generateNodeIdFromLabel } from "@/lib/utils/nodeId";

type SetNodes = (updater: (nodes: CanvasNode[]) => CanvasNode[]) => void;

/**
 * A connection drawn out of a branch node adds a case to its branch table.
 * The case value is a placeholder for the author to rename.
 */
export function handleBranchConnection(
  params: Connection,
  nodes: CanvasNode[],
  setNodes: SetNodes,
  selectNode: (nodeId: string, functionIndex: number, caseIndex: number) => void
): boolean {
  if (!params.source || !params.target) return false;
  const branchNode = nodes.find((n) => n.id === params.source);
  if (!branchNode || !isBranchNode(branchNode)) return false;

  const parsed = parseBranchNodeId(branchNode.id);
  if (!parsed) return false;
  const sourceNode = nodes.find((n) => n.id === parsed.sourceNodeId);
  const functions = nodeFunctions(sourceNode);
  const functionIndex = functions.findIndex(
    (fn) => fn.name === parsed.functionName && isBranch(fn.transition_to)
  );
  if (!sourceNode || functionIndex < 0) return false;

  const fn = functions[functionIndex];
  if (!isBranch(fn.transition_to)) return false;
  const cases = fn.transition_to.cases;
  const updated: FlowConfigFunction = {
    ...fn,
    transition_to: { ...fn.transition_to, cases: addCase(cases, params.target) },
  };

  setNodes((nds) =>
    nds.map((n) =>
      n.id === sourceNode.id && n.type !== "decision"
        ? {
            ...n,
            data: {
              ...n.data,
              functions: functions.map((f, i) => (i === functionIndex ? updated : f)),
            },
          }
        : n
    )
  );

  selectNode(sourceNode.id, functionIndex, Object.keys(cases).length);
  return true;
}

/** A connection drawn out of a node adds a function with that destination. */
export function handleRegularConnection(
  params: Connection,
  nodes: CanvasNode[],
  setNodes: SetNodes,
  selectNode: (nodeId: string, functionIndex: number) => void
): void {
  if (!params.source || !params.target) return;
  const sourceNode = nodes.find((n) => n.id === params.source);
  if (!sourceNode || sourceNode.type === "decision") return;

  const functions = nodeFunctions(sourceNode);
  const existingNames = functions.map((fn) => fn.name).filter(Boolean);
  const name = generateNodeIdFromLabel(`function_${existingNames.length + 1}`, existingNames);
  const newFunction: FlowConfigFunction = { name, transition_to: params.target };

  setNodes((nds) =>
    nds.map((n) =>
      n.id === params.source && n.type !== "decision"
        ? { ...n, data: { ...n.data, functions: [...functions, newFunction] } }
        : n
    )
  );

  selectNode(params.source, functions.length);
}
