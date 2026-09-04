import {
  type CanvasEdge,
  type CanvasNode,
  type ConfigNodeData,
  isConfigNode,
} from "@/lib/convert/configToCanvas";
import { type FlowConfigFunction, isBranch } from "@/lib/schema/flowConfig";

import { removeCase, renameCase } from "./branchEdits";
import { deriveNodeType } from "./nodeType";

/** Merges `updates` into a node's data and re-derives its display type. */
export function updateNodeData(
  nodes: CanvasNode[],
  nodeId: string,
  updates: Partial<ConfigNodeData>
): CanvasNode[] {
  return nodes.map((node) => {
    if (node.id !== nodeId || !isConfigNode(node)) return node;
    const type = deriveNodeType({ ...node.data, ...updates }, node.type);
    return { ...node, type, data: { ...node.data, ...updates, type } };
  });
}

function updateFunctions(
  nodes: CanvasNode[],
  nodeId: string,
  update: (functions: FlowConfigFunction[]) => FlowConfigFunction[]
): CanvasNode[] {
  return nodes.map((node) => {
    if (node.id !== nodeId || !isConfigNode(node)) return node;
    return { ...node, data: { ...node.data, functions: update(node.data.functions ?? []) } };
  });
}

/** Removes a function's destination so the tool stays on its node. */
export function clearFunctionConnection(
  nodes: CanvasNode[],
  nodeId: string,
  functionIndex: number
): CanvasNode[] {
  return updateFunctions(nodes, nodeId, (functions) =>
    functions.map((fn, i) => {
      if (i !== functionIndex) return fn;
      const { transition_to: _transition, ...rest } = fn;
      return rest;
    })
  );
}

/**
 * Removes what an edge stands for: the destination of a transition, or one
 * case or the default of a branch table.
 */
export function removeEdgeRoute(nodes: CanvasNode[], edge: CanvasEdge): CanvasNode[] {
  const data = edge.data;
  if (!data) return nodes;
  return updateFunctions(nodes, data.sourceNodeId, (functions) =>
    functions.map((fn, i) => {
      if (i !== data.functionIndex) return fn;
      if (data.kind === "transition") {
        const { transition_to: _transition, ...rest } = fn;
        return rest;
      }
      if (!isBranch(fn.transition_to)) return fn;
      if (data.kind === "default") {
        const { default: _default, ...branch } = fn.transition_to;
        return { ...fn, transition_to: branch };
      }
      const cases = { ...fn.transition_to.cases };
      if (data.caseValue !== undefined) delete cases[data.caseValue];
      return { ...fn, transition_to: { ...fn.transition_to, cases } };
    })
  );
}

/**
 * Removes one row of a function's branch table: the case at `conditionIndex`,
 * or the default when it is -1.
 */
export function removeBranchCase(
  nodes: CanvasNode[],
  nodeId: string,
  functionIndex: number,
  conditionIndex: number
): CanvasNode[] {
  return updateFunctions(nodes, nodeId, (functions) =>
    functions.map((fn, i) => {
      if (i !== functionIndex || !isBranch(fn.transition_to)) return fn;
      if (conditionIndex === -1) {
        const { default: _default, ...branch } = fn.transition_to;
        return { ...fn, transition_to: branch };
      }
      const value = Object.keys(fn.transition_to.cases)[conditionIndex];
      if (value === undefined) return fn;
      return {
        ...fn,
        transition_to: { ...fn.transition_to, cases: removeCase(fn.transition_to.cases, value) },
      };
    })
  );
}

/** Adds a function with no destination; it stays on the node until routed. */
export function addFunction(nodes: CanvasNode[], nodeId: string, name: string): CanvasNode[] {
  return updateFunctions(nodes, nodeId, (functions) => [...functions, { name }]);
}

export function removeFunction(nodes: CanvasNode[], nodeId: string, functionIndex: number) {
  return updateFunctions(nodes, nodeId, (functions) =>
    functions.filter((_, i) => i !== functionIndex)
  );
}

export function renameFunction(
  nodes: CanvasNode[],
  nodeId: string,
  functionIndex: number,
  name: string
): CanvasNode[] {
  return updateFunctions(nodes, nodeId, (functions) =>
    functions.map((fn, i) => (i === functionIndex ? { ...fn, name } : fn))
  );
}

/** Renames a case value in place. Leaves the nodes alone when the new value is empty or taken. */
export function renameBranchCase(
  nodes: CanvasNode[],
  nodeId: string,
  functionIndex: number,
  oldValue: string,
  newValue: string
): CanvasNode[] {
  return updateFunctions(nodes, nodeId, (functions) =>
    functions.map((fn, i) => {
      if (i !== functionIndex || !isBranch(fn.transition_to)) return fn;
      const cases = renameCase(fn.transition_to.cases, oldValue, newValue);
      return cases ? { ...fn, transition_to: { ...fn.transition_to, cases } } : fn;
    })
  );
}

/** Sets the field a function branch keys on. Leaves a function without a branch alone. */
export function setBranchField(
  nodes: CanvasNode[],
  nodeId: string,
  functionIndex: number,
  field: string
): CanvasNode[] {
  return updateFunctions(nodes, nodeId, (functions) =>
    functions.map((fn, i) =>
      i === functionIndex && isBranch(fn.transition_to)
        ? { ...fn, transition_to: { ...fn.transition_to, field } }
        : fn
    )
  );
}

/**
 * Drops every destination naming `nodeId`: a function that led there stays
 * on its node, a case that led there is removed, and a default that led
 * there is dropped. A branch left with no cases loses its destination.
 */
export function dropFunctionTargets(
  functions: FlowConfigFunction[],
  nodeId: string
): FlowConfigFunction[] {
  return functions.map((fn) => {
    const transition = fn.transition_to;
    if (transition === undefined || transition === null) return fn;
    if (!isBranch(transition)) {
      if (transition !== nodeId) return fn;
      const { transition_to: _transition, ...rest } = fn;
      return rest;
    }
    const cases = Object.fromEntries(
      Object.entries(transition.cases).filter(([, target]) => target !== nodeId)
    );
    if (Object.keys(cases).length === 0) {
      const { transition_to: _transition, ...rest } = fn;
      return rest;
    }
    const { default: fallback, ...branch } = transition;
    return {
      ...fn,
      transition_to:
        fallback && fallback !== nodeId
          ? { ...branch, cases, default: fallback }
          : { ...branch, cases },
    };
  });
}

/** Rewrites every destination naming `oldId` to `newId`. */
export function renameFunctionTargets(
  functions: FlowConfigFunction[],
  oldId: string,
  newId: string
): FlowConfigFunction[] {
  return functions.map((fn) => {
    const transition = fn.transition_to;
    if (transition === oldId) return { ...fn, transition_to: newId };
    if (!isBranch(transition)) return fn;
    const cases = Object.fromEntries(
      Object.entries(transition.cases).map(([value, target]) => [
        value,
        target === oldId ? newId : target,
      ])
    );
    const branch = { ...transition, cases };
    if (branch.default === oldId) branch.default = newId;
    return { ...fn, transition_to: branch };
  });
}

/** Renames a node and rewrites every destination that pointed at it. */
export function renameNode(nodes: CanvasNode[], oldId: string, newId: string): CanvasNode[] {
  return nodes.map((node) => {
    if (!isConfigNode(node)) return node;
    const functions = renameFunctionTargets(node.data.functions ?? [], oldId, newId);
    if (node.id === oldId) {
      return { ...node, id: newId, data: { ...node.data, name: newId, label: newId, functions } };
    }
    return { ...node, data: { ...node.data, functions } };
  });
}
