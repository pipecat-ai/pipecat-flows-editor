import { describe, expect, it } from "vitest";

import {
  type CanvasNode,
  type ConfigCanvasNode,
  configToCanvas,
} from "@/lib/convert/configToCanvas";
import type { FlowConfig } from "@/lib/schema/flowConfig";
import { handleConnection } from "@/lib/utils/connectionHandlers";
import { duplicateNode } from "@/lib/utils/nodeDuplication";
import { deriveNodeType } from "@/lib/utils/nodeType";
import {
  clearFunctionConnection,
  removeEdgeRoute,
  renameFunctionTargets,
  renameNode,
  updateNodeData,
} from "@/lib/utils/nodeUpdates";

const config: FlowConfig = {
  initial_node: "a",
  nodes: {
    a: {
      task_messages: [],
      functions: [
        { name: "go", transition_to: "b" },
        {
          name: "check",
          transition_to: { field: "s", cases: { ok: "b", bad: "a" }, default: "b" },
        },
      ],
    },
    b: { task_messages: [], post_actions: [{ type: "end_conversation" }] },
  },
};

const canvas = () => configToCanvas(config);
const functionsOf = (nodes: CanvasNode[], id: string) =>
  (nodes.find((n) => n.id === id) as ConfigCanvasNode).data.functions ?? [];

describe("deriveNodeType", () => {
  it("keeps the initial node initial and derives end from post_actions", () => {
    expect(deriveNodeType({ post_actions: [{ type: "end_conversation" }] }, "initial")).toBe(
      "initial"
    );
    expect(deriveNodeType({ post_actions: [{ type: "end_conversation" }] }, "node")).toBe("end");
    expect(deriveNodeType({ post_actions: [] }, "end")).toBe("node");
  });
});

describe("updateNodeData", () => {
  it("merges data and re-derives the type", () => {
    const nodes = updateNodeData(canvas().nodes, "a", {
      post_actions: [{ type: "end_conversation" }],
    });
    const a = nodes.find((n) => n.id === "a")!;
    expect(a.type).toBe("initial");
    const nodes2 = updateNodeData(canvas().nodes, "b", { post_actions: [] });
    expect(nodes2.find((n) => n.id === "b")!.type).toBe("node");
  });
});

describe("renameNode", () => {
  it("renames the node and rewrites transitions, cases, and defaults", () => {
    const nodes = renameNode(canvas().nodes, "b", "done");
    const renamed = nodes.find((n) => n.id === "done") as ConfigCanvasNode;
    expect(renamed.data).toMatchObject({ name: "done", label: "done" });
    expect(functionsOf(nodes, "a")).toEqual([
      { name: "go", transition_to: "done" },
      {
        name: "check",
        transition_to: { field: "s", cases: { ok: "done", bad: "a" }, default: "done" },
      },
    ]);
  });

  it("rewrites global function targets", () => {
    expect(renameFunctionTargets([{ name: "help", transition_to: "b" }], "b", "c")).toEqual([
      { name: "help", transition_to: "c" },
    ]);
  });
});

describe("clearFunctionConnection and removeEdgeRoute", () => {
  it("drops a function's destination", () => {
    const nodes = clearFunctionConnection(canvas().nodes, "a", 0);
    expect(functionsOf(nodes, "a")[0]).toEqual({ name: "go" });
  });

  it("removes one case or the default for a branch edge", () => {
    const { nodes, edges } = canvas();
    const caseEdge = edges.find((e) => e.data?.kind === "case" && e.data.caseValue === "bad")!;
    const defaultEdge = edges.find((e) => e.data?.kind === "default")!;
    const afterCase = removeEdgeRoute(nodes, caseEdge);
    expect(functionsOf(afterCase, "a")[1].transition_to).toEqual({
      field: "s",
      cases: { ok: "b" },
      default: "b",
    });
    const afterDefault = removeEdgeRoute(nodes, defaultEdge);
    expect(functionsOf(afterDefault, "a")[1].transition_to).toEqual({
      field: "s",
      cases: { ok: "b", bad: "a" },
    });
  });

  it("removes the whole destination for a transition edge", () => {
    const { nodes, edges } = canvas();
    const transition = edges.find((e) => e.data?.kind === "transition")!;
    expect(functionsOf(removeEdgeRoute(nodes, transition), "a")[0]).toEqual({ name: "go" });
  });
});

describe("handleConnection", () => {
  const connect = (nodesIn: CanvasNode[], sourceHandle: string | null, target: string) => {
    let nodes = nodesIn;
    const result = handleConnection(
      { source: "a", target, sourceHandle, targetHandle: null },
      nodes,
      (update) => (nodes = update(nodes))
    );
    return { result, nodes };
  };

  it("adds a function from the node's own handle", () => {
    const { result, nodes } = connect(canvas().nodes, null, "b");
    expect(functionsOf(nodes, "a")[2]).toEqual({ name: "function_3", transition_to: "b" });
    expect(result).toEqual({ sourceNodeId: "a", functionIndex: 2, caseIndex: null });
  });

  it("sets a function's destination from its row", () => {
    const { result, nodes } = connect(canvas().nodes, "fn:go", "a");
    expect(functionsOf(nodes, "a")[0]).toEqual({ name: "go", transition_to: "a" });
    expect(result).toEqual({ sourceNodeId: "a", functionIndex: 0, caseIndex: null });
  });

  it("sets a case's target, the default, or adds a case from the branch's rows", () => {
    const retarget = connect(canvas().nodes, "fn:check:case:bad", "b");
    expect(functionsOf(retarget.nodes, "a")[1].transition_to).toMatchObject({
      cases: { ok: "b", bad: "b" },
    });
    expect(retarget.result).toEqual({ sourceNodeId: "a", functionIndex: 1, caseIndex: 1 });

    const setDefault = connect(canvas().nodes, "fn:check:default", "a");
    expect(functionsOf(setDefault.nodes, "a")[1].transition_to).toMatchObject({ default: "a" });
    expect(setDefault.result?.caseIndex).toBe(-1);

    const addNew = connect(canvas().nodes, "fn:check:new-case", "a");
    expect(functionsOf(addNew.nodes, "a")[1].transition_to).toMatchObject({
      cases: { ok: "b", bad: "a", value_3: "a" },
    });
    expect(addNew.result?.caseIndex).toBe(2);
  });

  it("ignores handles that name nothing", () => {
    const { result, nodes } = connect(canvas().nodes, "fn:missing", "b");
    expect(result).toBeNull();
    expect(nodes).toEqual(canvas().nodes);
    expect(connect(canvas().nodes, "fn:go:case:x", "b").result).toBeNull();
  });
});

describe("duplicateNode", () => {
  it("copies a node under a new name and demotes an initial node", () => {
    const nodes = canvas().nodes;
    const a = nodes.find((n) => n.id === "a") as ConfigCanvasNode;
    const copy = duplicateNode(a, nodes);
    expect(copy.id).toBe("a_copy");
    expect(copy.type).toBe("node");
    expect(copy.data).toMatchObject({ name: "a_copy", label: "a_copy", type: "node" });
    expect(copy.data.functions).toEqual(a.data.functions);
    expect(duplicateNode(a, [...nodes, copy]).id).toBe("a_copy_1");
  });
});
