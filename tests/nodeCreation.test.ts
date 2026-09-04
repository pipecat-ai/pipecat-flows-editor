import { describe, expect, it } from "vitest";

import { deriveCanvasEdges } from "@/lib/convert/canvasGraph";
import { type ConfigCanvasNode, configToCanvas } from "@/lib/convert/configToCanvas";
import type { FlowConfig } from "@/lib/schema/flowConfig";
import {
  addBranchCaseDestination,
  addDestination,
  addFunctionDestination,
  setInitialNode,
} from "@/lib/utils/nodeCreation";
import { canDeleteNode } from "@/lib/utils/nodeDeletion";

const config: FlowConfig = {
  initial_node: "start",
  nodes: {
    start: { task_messages: [], functions: [{ name: "go", transition_to: "next" }] },
    next: { task_messages: [] },
  },
};
const canvas = () => configToCanvas(config);
const configNode = (nodes: ReturnType<typeof canvas>["nodes"], id: string) =>
  nodes.find((n) => n.id === id) as ConfigCanvasNode;

describe("addDestination", () => {
  it("adds a node and a function on the source routing to it", () => {
    const added = addDestination(canvas().nodes, "start", "node")!;
    expect(added.newNodeId).toBe("node");
    expect(added).toMatchObject({ sourceNodeId: "start", functionIndex: 1, caseIndex: undefined });
    expect(configNode(added.nodes, "start").data.functions).toEqual([
      { name: "go", transition_to: "next" },
      { name: "function_2", transition_to: "node" },
    ]);
    const node = configNode(added.nodes, "node");
    expect(node.type).toBe("node");
    expect(node.data).toMatchObject({ name: "node", label: "node", type: "node" });
    expect(node.data.task_messages.length).toBeGreaterThan(0);
  });

  it("places children to the right of the source, stacked past existing destinations", () => {
    const nodes = canvas().nodes.map((n) =>
      n.id === "start"
        ? { ...n, position: { x: 100, y: 50 }, measured: { width: 80, height: 32 } }
        : n
    );
    const first = addDestination(nodes, "start", "node")!;
    expect(configNode(first.nodes, first.newNodeId!).position).toEqual({ x: 270, y: 170 });
    const second = addDestination(first.nodes, "start", "end")!;
    expect(configNode(second.nodes, second.newNodeId!).position).toEqual({ x: 270, y: 290 });
  });

  it("adds an end node with an end_conversation post-action", () => {
    const added = addDestination(canvas().nodes, "start", "end")!;
    const node = configNode(added.nodes, added.newNodeId!);
    expect(added.newNodeId).toBe("end");
    expect(node.type).toBe("end");
    expect(node.data.post_actions).toEqual([{ type: "end_conversation" }]);
  });

  it("adds a branch whose first case leads to the new node", () => {
    const added = addDestination(canvas().nodes, "start", "branch")!;
    expect(added.caseIndex).toBe(0);
    expect(configNode(added.nodes, "start").data.functions![1]).toEqual({
      name: "function_2",
      transition_to: { field: "", cases: { value_1: added.newNodeId } },
    });
    expect(deriveCanvasEdges(added.nodes).map((e) => [e.sourceHandle, e.target])).toEqual([
      ["fn:0", "next"],
      ["fn:1:case:value_1", added.newNodeId],
    ]);
  });

  it("picks unused names", () => {
    const once = addDestination(canvas().nodes, "start", "node")!;
    const twice = addDestination(once.nodes, "start", "node")!;
    expect(twice.newNodeId).toBe("node_1");
    expect(configNode(twice.nodes, "start").data.functions!.map((f) => f.name)).toEqual([
      "go",
      "function_2",
      "function_3",
    ]);
  });

  it("adds a function that stays on the node", () => {
    const added = addDestination(canvas().nodes, "start", "stay")!;
    expect(added).toEqual({
      nodes: expect.any(Array),
      newNodeId: null,
      sourceNodeId: "start",
      functionIndex: 1,
    });
    expect(added.nodes).toHaveLength(2);
    expect(configNode(added.nodes, "start").data.functions![1]).toEqual({ name: "" });
  });

  it("returns null for an unknown source", () => {
    expect(addDestination(canvas().nodes, "missing", "node")).toBeNull();
  });
});

describe("addFunctionDestination", () => {
  it("gives a function without a destination a new node, or a branch leading to one", () => {
    const nodes = canvas().nodes.map((n) =>
      n.id === "start" ? { ...n, data: { ...n.data, functions: [{ name: "stay" }] } } : n
    );
    const asNode = addFunctionDestination(nodes, "start", 0, "end")!;
    expect(configNode(asNode.nodes, "start").data.functions).toEqual([
      { name: "stay", transition_to: asNode.newNodeId },
    ]);
    expect(configNode(asNode.nodes, asNode.newNodeId!).type).toBe("end");
    expect(asNode).toMatchObject({ functionIndex: 0, caseIndex: undefined });

    const asBranch = addFunctionDestination(nodes, "start", 0, "branch")!;
    expect(configNode(asBranch.nodes, "start").data.functions![0].transition_to).toEqual({
      field: "",
      cases: { value_1: asBranch.newNodeId },
    });
    expect(asBranch.caseIndex).toBe(0);
  });

  it("leaves a function that already has a destination alone", () => {
    expect(addFunctionDestination(canvas().nodes, "start", 0, "node")).toBeNull();
  });
});

describe("addBranchCaseDestination", () => {
  it("adds a node and a case on the branch leading to it", () => {
    const withBranch = addDestination(canvas().nodes, "start", "branch")!;
    const added = addBranchCaseDestination(withBranch.nodes, "start", 1)!;
    expect(added).toMatchObject({ sourceNodeId: "start", functionIndex: 1, caseIndex: 1 });
    expect(configNode(added.nodes, "start").data.functions![1].transition_to).toEqual({
      field: "",
      cases: { value_1: withBranch.newNodeId, value_2: added.newNodeId },
    });
    expect(addBranchCaseDestination(withBranch.nodes, "start", 0)).toBeNull();
  });
});

describe("setInitialNode", () => {
  it("moves the initial designation and re-derives the old node's type", () => {
    const nodes = setInitialNode(canvas().nodes, "next");
    expect(configNode(nodes, "next").type).toBe("initial");
    expect(configNode(nodes, "next").data.type).toBe("initial");
    expect(configNode(nodes, "start").type).toBe("node");
    expect(setInitialNode(nodes, "missing")).toBe(nodes);
  });

  it("keeps the initial node from being deleted", () => {
    const nodes = canvas().nodes;
    expect(canDeleteNode(configNode(nodes, "start"))).toBe(false);
    expect(canDeleteNode(configNode(nodes, "next"))).toBe(true);
  });
});
