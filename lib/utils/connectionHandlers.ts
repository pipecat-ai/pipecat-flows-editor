import type { Connection, Node } from "reactflow";

import type { DecisionConditionJson, FlowFunctionJson } from "@/lib/schema/flow.schema";
import { findDecisionSource, parseDecisionNodeId } from "@/lib/utils/decisionNodes";
import { generateNodeIdFromLabel } from "@/lib/utils/nodeId";

/**
 * Handle connection from a decision node - adds a condition
 */
export function handleDecisionNodeConnection(
  params: Connection,
  nodes: Node[],
  setNodes: (updater: (nodes: Node[]) => Node[]) => void,
  selectNode: (nodeId: string, functionIndex: number, conditionIndex: number) => void
): boolean {
  if (!params.source || !params.target) return false;

  const sourceNode = nodes.find((n) => n.id === params.source);
  if (!sourceNode || sourceNode.type !== "decision") return false;

  const parsed = parseDecisionNodeId(sourceNode.id);
  if (!parsed) return false;

  const decisionSource = findDecisionSource(sourceNode.id, nodes);
  if (!decisionSource || !decisionSource.function.decision) return false;

  const { sourceNode: actualSourceNode, functionIndex, function: func } = decisionSource;

  // Add new condition
  const newCondition: DecisionConditionJson = {
    operator: "==",
    value: "",
    next_node_id: params.target,
  };

  const updatedFunctions = [...((actualSourceNode.data as any)?.functions as FlowFunctionJson[])];
  updatedFunctions[functionIndex] = {
    ...func,
    decision: {
      ...func.decision!,
      conditions: [...func.decision!.conditions, newCondition],
    },
  };

  setNodes((nds) =>
    nds.map((n) =>
      n.id === actualSourceNode.id
        ? {
            ...n,
            data: {
              ...n.data,
              functions: updatedFunctions,
            },
          }
        : n
    )
  );

  // Select the source node, function, and new condition
  const newConditionIndex = func.decision!.conditions.length;
  selectNode(actualSourceNode.id, functionIndex, newConditionIndex);

  return true;
}

/**
 * Handle regular connection - creates a new function
 */
export function handleRegularConnection(
  params: Connection,
  nodes: Node[],
  setNodes: (updater: (nodes: Node[]) => Node[]) => void,
  selectNode: (nodeId: string, functionIndex: number) => void
): void {
  if (!params.source || !params.target) return;

  const sourceNode = nodes.find((n) => n.id === params.source);
  if (!sourceNode) return;

  const functions = ((sourceNode.data as any)?.functions as FlowFunctionJson[] | undefined) ?? [];
  const existingFunctionNames = functions.map((f) => f.name).filter(Boolean);
  const defaultFunctionName = `function_${existingFunctionNames.length + 1}`;
  const functionName = generateNodeIdFromLabel(defaultFunctionName, existingFunctionNames);

  const newFunction: FlowFunctionJson = {
    name: functionName,
    description: "",
    next_node_id: params.target,
  };

  setNodes((nds) =>
    nds.map((n) =>
      n.id === params.source
        ? {
            ...n,
            data: {
              ...n.data,
              functions: [...functions, newFunction],
            },
          }
        : n
    )
  );

  selectNode(params.source, functions.length);
}
