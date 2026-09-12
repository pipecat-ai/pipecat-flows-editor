import type { Connection } from "@xyflow/react";

import { type CanvasNode, nodeFunctions, parseHandleId } from "@/lib/convert/configToCanvas";
import { type FlowConfigFunction, isBranch } from "@/lib/schema/flowConfig";
import { addCase, setCaseTarget } from "@/lib/utils/branchEdits";
import { newFunctionName } from "@/lib/utils/nodeCreation";

type SetNodes = (updater: (nodes: CanvasNode[]) => CanvasNode[]) => void;

export interface Connected {
  sourceNodeId: string;
  functionIndex: number;
  caseIndex: number | null;
}

/**
 * A connection drawn from a row's handle sets that row's destination: a
 * function's `transition_to`, a case's target, or the branch default. From
 * the "add a case" row it adds a case, and from the node's own handle it adds
 * a function. Returns what to select, or null when nothing changed.
 */
export function handleConnection(
  params: Connection,
  nodes: CanvasNode[],
  setNodes: SetNodes
): Connected | null {
  const { source, target } = params;
  if (!source || !target) return null;
  const sourceNode = nodes.find((n) => n.id === source);
  if (!sourceNode) return null;

  const functions = nodeFunctions(sourceNode);
  const handle = parseHandleId(params.sourceHandle);
  const commit = (updated: FlowConfigFunction[]) =>
    setNodes((nds) =>
      nds.map((n) => (n.id === source ? { ...n, data: { ...n.data, functions: updated } } : n))
    );

  if (handle.kind === "new-function") {
    commit([...functions, { name: newFunctionName(functions), transition_to: target }]);
    return { sourceNodeId: source, functionIndex: functions.length, caseIndex: null };
  }

  const functionIndex = handle.functionIndex;
  const fn = functions[functionIndex];
  if (!fn) return null;
  const replace = (updated: FlowConfigFunction) =>
    commit(functions.map((f, i) => (i === functionIndex ? updated : f)));

  if (handle.kind === "function") {
    replace({ ...fn, transition_to: target });
    return { sourceNodeId: source, functionIndex, caseIndex: null };
  }

  if (!isBranch(fn.transition_to)) return null;
  const branch = fn.transition_to;
  switch (handle.kind) {
    case "case": {
      const caseIndex = Object.keys(branch.cases).indexOf(handle.caseValue);
      if (caseIndex < 0) return null;
      replace({
        ...fn,
        transition_to: { ...branch, cases: setCaseTarget(branch.cases, handle.caseValue, target) },
      });
      return { sourceNodeId: source, functionIndex, caseIndex };
    }
    case "default":
      replace({ ...fn, transition_to: { ...branch, default: target } });
      return { sourceNodeId: source, functionIndex, caseIndex: -1 };
    case "new-case":
      replace({ ...fn, transition_to: { ...branch, cases: addCase(branch.cases, target) } });
      return { sourceNodeId: source, functionIndex, caseIndex: Object.keys(branch.cases).length };
  }
}
