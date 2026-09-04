import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { beforeEach, describe, expect, it } from "vitest";
import { parse } from "yaml";

import {
  branchNodeId,
  configToCanvas,
  configToGraph,
  deriveConfigNodeType,
  parseBranchNodeId,
} from "@/lib/convert/configToCanvas";
import { estimateNodeSize, layoutNodes } from "@/lib/layout/autoLayout";
import type { FlowConfig } from "@/lib/schema/flowConfig";
import { clearPositions, loadPositions, savePositions } from "@/lib/storage/positionStore";

function loadExample(name: string): FlowConfig {
  return parse(readFileSync(resolve(__dirname, "../lib/examples", name), "utf8"));
}

const foodOrdering = loadExample("food_ordering.yaml");
const restaurantReservation = loadExample("restaurant_reservation.yaml");

describe("deriveConfigNodeType", () => {
  it("marks the initial node, end nodes, and everything else", () => {
    const end = { task_messages: [], post_actions: [{ type: "end_conversation" }] };
    const plain = { task_messages: [] };
    expect(deriveConfigNodeType("a", plain, "a")).toBe("initial");
    expect(deriveConfigNodeType("a", end, "b")).toBe("end");
    expect(deriveConfigNodeType("a", plain, "b")).toBe("node");
  });

  it("lets initial_node win over an end_conversation post-action", () => {
    const end = { task_messages: [], post_actions: [{ type: "end_conversation" }] };
    expect(deriveConfigNodeType("a", end, "a")).toBe("initial");
  });
});

describe("configToGraph", () => {
  it("maps food_ordering to one node per config node and one edge per destination", () => {
    const { nodes, edges } = configToGraph(foodOrdering);
    expect(nodes.map((n) => [n.id, n.type])).toEqual([
      ["initial", "initial"],
      ["choose_pizza", "node"],
      ["choose_sushi", "node"],
      ["confirm", "node"],
      ["end", "end"],
    ]);
    expect(edges.map((e) => [e.source, e.label, e.target])).toEqual([
      ["initial", "choose_pizza", "choose_pizza"],
      ["initial", "choose_sushi", "choose_sushi"],
      ["choose_pizza", "select_pizza_order", "confirm"],
      ["choose_sushi", "select_sushi_order", "confirm"],
      ["confirm", "complete_order", "end"],
      ["confirm", "revise_order", "initial"],
    ]);
    expect(edges.every((e) => e.type === "default")).toBe(true);
  });

  it("carries the config node's fields and name onto the canvas node data", () => {
    const { nodes } = configToGraph(foodOrdering);
    const initial = nodes.find((n) => n.id === "initial")!;
    expect(initial.data).toMatchObject({
      label: "initial",
      name: "initial",
      type: "initial",
      pre_actions: [{ type: "function", handler: "check_kitchen_status" }],
      functions: [
        { name: "choose_pizza", transition_to: "choose_pizza" },
        { name: "choose_sushi", transition_to: "choose_sushi" },
      ],
    });
    expect(typeof initial.data.role_message).toBe("string");
  });

  it("draws a branch node with one edge per case for restaurant_reservation", () => {
    const { nodes, edges } = configToGraph(restaurantReservation);
    const branch = nodes.find((n) => n.id === branchNodeId("get_time", "check_availability"))!;
    expect(branch.type).toBe("decision");
    expect(branch.data).toEqual({
      label: "check_availability",
      type: "decision",
      sourceNodeId: "get_time",
      functionName: "check_availability",
      field: "status",
      caseCount: 2,
      hasDefault: false,
    });
    const branchEdges = edges.filter((e) => e.source === branch.id || e.target === branch.id);
    expect(branchEdges.map((e) => [e.source, e.label, e.target])).toEqual([
      ["get_time", "check_availability", branch.id],
      [branch.id, "available", "confirm"],
      [branch.id, "unavailable", "no_availability"],
    ]);
  });

  it("adds a default edge when the branch has one", () => {
    const config: FlowConfig = {
      initial_node: "a",
      nodes: {
        a: {
          task_messages: [],
          functions: [
            { name: "f", transition_to: { field: "k", cases: { x: "b" }, default: "a" } },
          ],
        },
        b: { task_messages: [] },
      },
    };
    const { edges } = configToGraph(config);
    const branch = branchNodeId("a", "f");
    expect(edges.map((e) => [e.id, e.source, e.label, e.target])).toEqual([
      ["edge:a:f", "a", "f", branch],
      [`${branch}:case:x`, branch, "x", "b"],
      [`${branch}:default`, branch, "default", "a"],
    ]);
  });

  it("uses the self-loop edge type for a function that returns to its own node", () => {
    const config: FlowConfig = {
      initial_node: "a",
      nodes: { a: { task_messages: [], functions: [{ name: "again", transition_to: "a" }] } },
    };
    expect(configToGraph(config).edges[0]).toMatchObject({
      source: "a",
      target: "a",
      type: "selfloop",
    });
  });

  it("draws nothing for functions without a destination and for global functions", () => {
    const { nodes, edges } = configToGraph(foodOrdering);
    expect(foodOrdering.global_functions).toEqual([{ name: "get_delivery_estimate" }]);
    expect(nodes).toHaveLength(5);
    expect(edges.some((e) => e.label === "get_delivery_estimate")).toBe(false);
  });

  it("round-trips branch node ids, including function names with the separator", () => {
    expect(parseBranchNodeId(branchNodeId("n", "f"))).toEqual({
      sourceNodeId: "n",
      functionName: "f",
    });
    expect(parseBranchNodeId(branchNodeId("n", "f:g"))).toEqual({
      sourceNodeId: "n",
      functionName: "f:g",
    });
    expect(parseBranchNodeId("n")).toBeNull();
    expect(parseBranchNodeId("edge:n:f")).toBeNull();
  });
});

describe("layoutNodes", () => {
  it("places every node and keeps sources above their targets", () => {
    const { nodes, edges } = configToGraph(foodOrdering);
    const placed = layoutNodes(nodes, edges);
    const byId = new Map(placed.map((n) => [n.id, n.position]));
    expect(placed).toHaveLength(nodes.length);
    for (const edge of edges) {
      const source = byId.get(edge.source)!;
      const target = byId.get(edge.target)!;
      if (edge.target === "initial") continue; // the revise_order back edge
      expect(target.y).toBeGreaterThan(source.y);
    }
  });

  it("does not overlap nodes in the same rank", () => {
    const { nodes, edges } = configToGraph(foodOrdering);
    const placed = layoutNodes(nodes, edges);
    const pizza = placed.find((n) => n.id === "choose_pizza")!;
    const sushi = placed.find((n) => n.id === "choose_sushi")!;
    expect(pizza.position.y).toBe(sushi.position.y);
    const gap = Math.abs(pizza.position.x - sushi.position.x);
    expect(gap).toBeGreaterThanOrEqual(estimateNodeSize(pizza).width);
  });

  it("lays out branch nodes between their source and targets", () => {
    const { nodes, edges } = configToGraph(restaurantReservation);
    const placed = layoutNodes(nodes, edges);
    const byId = new Map(placed.map((n) => [n.id, n.position]));
    const branch = byId.get(branchNodeId("get_time", "check_availability"))!;
    expect(branch.y).toBeGreaterThan(byId.get("get_time")!.y);
    expect(byId.get("confirm")!.y).toBeGreaterThan(branch.y);
  });

  it("survives self-loops and dangling edges", () => {
    const config: FlowConfig = {
      initial_node: "a",
      nodes: {
        a: {
          task_messages: [],
          functions: [
            { name: "again", transition_to: "a" },
            { name: "away", transition_to: "missing" },
          ],
        },
      },
    };
    const { nodes, edges } = configToGraph(config);
    expect(() => layoutNodes(nodes, edges)).not.toThrow();
  });

  it("prefers measured sizes over estimates", () => {
    const { nodes, edges } = configToGraph(foodOrdering);
    const measured = nodes.map((n) => ({ ...n, measured: { width: 400, height: 100 } }));
    const placed = layoutNodes(measured, edges);
    const pizza = placed.find((n) => n.id === "choose_pizza")!;
    const sushi = placed.find((n) => n.id === "choose_sushi")!;
    expect(Math.abs(pizza.position.x - sushi.position.x)).toBeGreaterThanOrEqual(400);
  });
});

describe("configToCanvas", () => {
  it("auto-lays out a config with no stored positions", () => {
    const { nodes } = configToCanvas(foodOrdering);
    const positions = nodes.map((n) => `${n.position.x},${n.position.y}`);
    expect(new Set(positions).size).toBe(nodes.length);
  });

  it("applies stored positions over the layout for the nodes they cover", () => {
    const stored = { initial: { x: 5, y: 7 }, confirm: { x: 900, y: 900 } };
    const { nodes } = configToCanvas(foodOrdering, { positions: stored });
    const byId = new Map(nodes.map((n) => [n.id, n.position]));
    expect(byId.get("initial")).toEqual({ x: 5, y: 7 });
    expect(byId.get("confirm")).toEqual({ x: 900, y: 900 });
    expect(byId.get("end")).not.toEqual({ x: 0, y: 0 });
  });

  it("stores positions for branch nodes by their canvas id", () => {
    const branch = branchNodeId("get_time", "check_availability");
    const { nodes } = configToCanvas(restaurantReservation, {
      positions: { [branch]: { x: 1, y: 2 } },
    });
    expect(nodes.find((n) => n.id === branch)!.position).toEqual({ x: 1, y: 2 });
  });
});

describe("positionStore", () => {
  beforeEach(() => localStorage.clear());

  it("saves and loads positions per flow name", () => {
    savePositions("food_ordering", { initial: { x: 1, y: 2 } });
    savePositions("other", { initial: { x: 3, y: 4 } });
    expect(loadPositions("food_ordering")).toEqual({ initial: { x: 1, y: 2 } });
    expect(loadPositions("other")).toEqual({ initial: { x: 3, y: 4 } });
    expect(loadPositions("unknown")).toEqual({});
  });

  it("ignores malformed stored values", () => {
    localStorage.setItem("pipecat-flows-editor/positions/bad", '{"a": {"x": "1"}}');
    localStorage.setItem("pipecat-flows-editor/positions/worse", "not json");
    expect(loadPositions("bad")).toEqual({});
    expect(loadPositions("worse")).toEqual({});
  });

  it("clears positions for one flow", () => {
    savePositions("food_ordering", { initial: { x: 1, y: 2 } });
    clearPositions("food_ordering");
    expect(loadPositions("food_ordering")).toEqual({});
  });
});
