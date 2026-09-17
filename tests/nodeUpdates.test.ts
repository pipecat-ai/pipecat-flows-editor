import { describe, expect, it } from "vitest";

import {
  type Canvas,
  type CanvasNode,
  type ConfigCanvasNode,
  configNodesOf,
  configToCanvas,
  decisionNodeId,
} from "@/lib/convert/configToCanvas";
import type { FlowConfig, FlowConfigFunction } from "@/lib/schema/flowConfig";
import { handleConnection } from "@/lib/utils/connectionHandlers";
import { duplicateNode } from "@/lib/utils/nodeDuplication";
import { deriveNodeType } from "@/lib/utils/nodeType";
import {
  addFunction,
  dropFunctionTargets,
  removeEdgeRoute,
  removeFunction,
  renameBranchCase,
  renameFunction,
  renameFunctionTargets,
  renameNode,
  setBranchField,
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

/** The config nodes of a canvas; the helpers here do not touch decision nodes. */
const configOnly = (canvas: Canvas): Omit<Canvas, "nodes"> & { nodes: CanvasNode[] } => ({
  ...canvas,
  nodes: configNodesOf(canvas.nodes),
});

const canvas = () => configOnly(configToCanvas(config));
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

describe("function rows", () => {
  it("adds, renames, and removes functions", () => {
    const added = addFunction(canvas().nodes, "a", "stay");
    expect(functionsOf(added, "a")[2]).toEqual({ name: "stay" });
    const renamed = renameFunction(added, "a", 2, "wait");
    expect(functionsOf(renamed, "a")[2]).toEqual({ name: "wait" });
    const removed = removeFunction(renamed, "a", 0);
    expect(functionsOf(removed, "a").map((fn) => fn.name)).toEqual(["check", "wait"]);
  });

  it("renames a case in place and refuses a taken or empty value", () => {
    const nodes = canvas().nodes;
    const renamed = renameBranchCase(nodes, "a", 1, "bad", "unavailable");
    expect(
      Object.keys((functionsOf(renamed, "a")[1].transition_to as { cases: object }).cases)
    ).toEqual(["ok", "unavailable"]);
    expect(renameBranchCase(nodes, "a", 1, "bad", "ok")).toEqual(nodes);
    expect(renameBranchCase(nodes, "a", 1, "bad", "")).toEqual(nodes);
    expect(renameBranchCase(nodes, "a", 0, "x", "y")).toEqual(nodes);
  });
});

describe("dropFunctionTargets", () => {
  it("drops transitions, cases, and defaults that led to the node", () => {
    const functions: FlowConfigFunction[] = [
      { name: "go", transition_to: "gone" },
      { name: "stay", transition_to: "kept" },
      {
        name: "check",
        transition_to: { field: "s", cases: { ok: "kept", bad: "gone" }, default: "gone" },
      },
      { name: "only", transition_to: { field: "s", cases: { bad: "gone" }, default: "kept" } },
      { name: "none" },
    ];
    expect(dropFunctionTargets(functions, "gone")).toEqual([
      { name: "go" },
      { name: "stay", transition_to: "kept" },
      { name: "check", transition_to: { field: "s", cases: { ok: "kept" } } },
      { name: "only" },
      { name: "none" },
    ]);
  });
});

describe("setBranchField", () => {
  it("sets the field on a branch and leaves other functions alone", () => {
    const nodes = setBranchField(canvas().nodes, "a", 1, "outcome");
    expect(functionsOf(nodes, "a")[1].transition_to).toMatchObject({ field: "outcome" });
    expect(setBranchField(canvas().nodes, "a", 0, "x")).toEqual(canvas().nodes);
  });
});

describe("removeEdgeRoute", () => {
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

  it("removes the whole branch for the edge into its decision node", () => {
    const { nodes, edges } = canvas();
    const branch = edges.find((e) => e.data?.kind === "branch")!;
    const after = functionsOf(removeEdgeRoute(nodes, branch), "a")[1];
    expect(after.transition_to).toBeUndefined();
    expect(after.name).toBe(functionsOf(nodes, "a")[1].name);
  });
});

describe("handleConnection", () => {
  const connect = (nodesIn: CanvasNode[], source: string, target: string) => {
    let nodes = nodesIn;
    const result = handleConnection(
      { source, target, sourceHandle: "out", targetHandle: "in" },
      nodes,
      (update) => (nodes = update(nodes))
    );
    return { result, nodes };
  };

  it("adds a function from a card's exit", () => {
    const { result, nodes } = connect(canvas().nodes, "a", "b");
    expect(functionsOf(nodes, "a")[2]).toEqual({ name: "function_3", transition_to: "b" });
    expect(result).toEqual({ sourceNodeId: "a", functionIndex: 2, caseIndex: null });
  });

  it("adds a case from a decision node", () => {
    const { result, nodes } = connect(canvas().nodes, decisionNodeId("a", 1), "a");
    expect(functionsOf(nodes, "a")[1].transition_to).toMatchObject({
      cases: { ok: "b", bad: "a", value_3: "a" },
    });
    expect(result).toEqual({ sourceNodeId: "a", functionIndex: 1, caseIndex: 2 });
  });

  it("ignores a connection into a decision node, from an unknown node, or from a decision of a plain function", () => {
    const nodes = canvas().nodes;
    expect(connect(nodes, "a", decisionNodeId("a", 1)).result).toBeNull();
    expect(connect(nodes, "nowhere", "b").result).toBeNull();
    expect(connect(nodes, decisionNodeId("a", 0), "b").result).toBeNull();
    expect(connect(nodes, decisionNodeId("a", 7), "b").result).toBeNull();
    expect(connect(nodes, "a", decisionNodeId("a", 1)).nodes).toEqual(nodes);
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
