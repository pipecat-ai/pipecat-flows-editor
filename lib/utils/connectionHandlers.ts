import type { Connection } from "@xyflow/react";

import { type CanvasNode, nodeFunctions, parseDecisionNodeId } from "@/lib/convert/configToCanvas";
import { type FlowConfigFunction, isBranch } from "@/lib/schema/flowConfig";
import { addCase } from "@/lib/utils/branchEdits";
import { newFunctionName } from "@/lib/utils/nodeCreation";

type SetNodes = (updater: (nodes: CanvasNode[]) => CanvasNode[]) => void;

export interface Connected {
  sourceNodeId: string;
  functionIndex: number;
  caseIndex: number | null;
}

/**
 * A connection drawn from a card's exit adds a function leading to the
 * target; one drawn from a decision node adds a case of its branch leading
 * there. A decision node cannot be a target. Returns what to select, or
 * null when nothing changed.
 */
export function handleConnection(
  params: Connection,
  nodes: CanvasNode[],
  setNodes: SetNodes
): Connected | null {
  const { source, target } = params;
  if (!source || !target || parseDecisionNodeId(target)) return null;

  const decision = parseDecisionNodeId(source);
  const sourceNodeId = decision?.sourceNodeId ?? source;
  const sourceNode = nodes.find((n) => n.id === sourceNodeId);
  if (!sourceNode) return null;

  const functions = nodeFunctions(sourceNode);
  const commit = (updated: FlowConfigFunction[]) =>
    setNodes((nds) =>
      nds.map((n) =>
        n.id === sourceNodeId ? { ...n, data: { ...n.data, functions: updated } } : n
      )
    );

  if (!decision) {
    commit([...functions, { name: newFunctionName(functions), transition_to: target }]);
    return { sourceNodeId, functionIndex: functions.length, caseIndex: null };
  }

  const { functionIndex } = decision;
  const fn = functions[functionIndex];
  if (!fn || !isBranch(fn.transition_to)) return null;
  const branch = fn.transition_to;
  commit(
    functions.map((f, i) =>
      i === functionIndex
        ? { ...f, transition_to: { ...branch, cases: addCase(branch.cases, target) } }
        : f
    )
  );
  return { sourceNodeId, functionIndex, caseIndex: Object.keys(branch.cases).length };
}
