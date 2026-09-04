import { describe, expect, it } from "vitest";

import {
  type CanvasNode,
  type ConfigCanvasNode,
  configToCanvas,
} from "@/lib/convert/configToCanvas";
import type { FlowConfig } from "@/lib/schema/flowConfig";
import { handleBranchConnection, handleRegularConnection } from "@/lib/utils/connectionHandlers";
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

  it("removes the whole destination for a transition or branch edge", () => {
    const { nodes, edges } = canvas();
    const branchEdge = edges.find((e) => e.data?.kind === "branch")!;
    expect(functionsOf(removeEdgeRoute(nodes, branchEdge), "a")[1]).toEqual({ name: "check" });
  });
});

describe("connection handlers", () => {
  it("adds a function for a connection between nodes", () => {
    let nodes = canvas().nodes;
    const selected: unknown[] = [];
    handleRegularConnection(
      { source: "b", target: "a", sourceHandle: null, targetHandle: null },
      nodes,
      (update) => (nodes = update(nodes)),
      (...args) => selected.push(args)
    );
    expect(functionsOf(nodes, "b")).toEqual([{ name: "function_1", transition_to: "a" }]);
    expect(selected).toEqual([["b", 0]]);
  });

  it("adds a case for a connection out of a branch node", () => {
    let nodes = canvas().nodes;
    const branch = nodes.find((n) => n.type === "decision")!;
    const selected: unknown[] = [];
    const handled = handleBranchConnection(
      { source: branch.id, target: "a", sourceHandle: null, targetHandle: null },
      nodes,
      (update) => (nodes = update(nodes)),
      (...args) => selected.push(args)
    );
    expect(handled).toBe(true);
    expect(functionsOf(nodes, "a")[1].transition_to).toEqual({
      field: "s",
      cases: { ok: "b", bad: "a", value_3: "a" },
      default: "b",
    });
    expect(selected).toEqual([["a", 1, 2]]);
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
