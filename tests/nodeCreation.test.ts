import { describe, expect, it } from "vitest";

import { deriveCanvasGraph } from "@/lib/convert/canvasGraph";
import { branchNodeId, type ConfigCanvasNode, configToCanvas } from "@/lib/convert/configToCanvas";
import type { FlowConfig } from "@/lib/schema/flowConfig";
import { addBranchCaseDestination, addDestination, setInitialNode } from "@/lib/utils/nodeCreation";
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

  it("places children below the source, fanned out past existing destinations", () => {
    const nodes = canvas().nodes.map((n) =>
      n.id === "start"
        ? { ...n, position: { x: 100, y: 50 }, measured: { width: 80, height: 32 } }
        : n
    );
    const first = addDestination(nodes, "start", "node")!;
    expect(configNode(first.nodes, first.newNodeId).position).toEqual({ x: 320, y: 182 });
    const second = addDestination(first.nodes, "start", "end")!;
    expect(configNode(second.nodes, second.newNodeId).position).toEqual({ x: 540, y: 182 });
  });

  it("adds an end node with an end_conversation post-action", () => {
    const added = addDestination(canvas().nodes, "start", "end")!;
    const node = configNode(added.nodes, added.newNodeId);
    expect(added.newNodeId).toBe("end");
    expect(node.type).toBe("end");
    expect(node.data.post_actions).toEqual([{ type: "end_conversation" }]);
  });

  it("adds a branch whose first case leads to the new node, with the diamond between them", () => {
    const nodes = canvas().nodes.map((n) =>
      n.id === "start"
        ? { ...n, position: { x: 100, y: 50 }, measured: { width: 80, height: 32 } }
        : n
    );
    const added = addDestination(nodes, "start", "branch")!;
    expect(added.caseIndex).toBe(0);
    expect(configNode(added.nodes, "start").data.functions![1]).toEqual({
      name: "function_2",
      transition_to: { field: "", cases: { value_1: added.newNodeId } },
    });
    const branch = added.nodes.find((n) => n.id === branchNodeId("start", "function_2"))!;
    const node = configNode(added.nodes, added.newNodeId);
    expect(branch.position).toEqual({ x: 320, y: 182 });
    expect(node.position.y).toBeGreaterThan(branch.position.y + 52);
    // The derivation keeps the diamond where it was placed
    const derived = deriveCanvasGraph(added.nodes);
    expect(derived.nodesChanged).toBe(false);
    expect(derived.nodes.find((n) => n.id === branch.id)!.position).toEqual(branch.position);
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

  it("returns null for a branch node or unknown source", () => {
    expect(addDestination(canvas().nodes, "missing", "node")).toBeNull();
  });
});

describe("addBranchCaseDestination", () => {
  it("adds a node and a case on the branch leading to it", () => {
    const withBranch = addDestination(canvas().nodes, "start", "branch")!;
    const nodes = deriveCanvasGraph(withBranch.nodes).nodes;
    const branchId = branchNodeId("start", "function_2");
    const added = addBranchCaseDestination(nodes, branchId)!;
    expect(added).toMatchObject({ sourceNodeId: "start", functionIndex: 1, caseIndex: 1 });
    expect(configNode(added.nodes, "start").data.functions![1].transition_to).toEqual({
      field: "",
      cases: { value_1: withBranch.newNodeId, value_2: added.newNodeId },
    });
    expect(addBranchCaseDestination(nodes, "start")).toBeNull();
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
