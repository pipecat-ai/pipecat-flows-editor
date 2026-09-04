import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { beforeEach, describe, expect, it } from "vitest";
import { parse } from "yaml";

import {
  configToCanvas,
  configToGraph,
  deriveConfigNodeType,
  handleId,
  parseHandleId,
} from "@/lib/convert/configToCanvas";
import { estimateNodeSize, layoutNodes, SELF_LOOP_HEADROOM } from "@/lib/layout/autoLayout";
import type { FlowConfig } from "@/lib/schema/flowConfig";
import { clearPositions, loadPositions, savePositions } from "@/lib/storage/positionStore";

function loadExample(name: string): FlowConfig {
  return parse(readFileSync(resolve(__dirname, "../public/examples", name), "utf8"));
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
    expect(edges.map((e) => [e.source, e.sourceHandle, e.target])).toEqual([
      ["initial", "fn:choose_pizza", "choose_pizza"],
      ["initial", "fn:choose_sushi", "choose_sushi"],
      ["choose_pizza", "fn:select_pizza_order", "confirm"],
      ["choose_sushi", "fn:select_sushi_order", "confirm"],
      ["confirm", "fn:complete_order", "end"],
      ["confirm", "fn:revise_order", "initial"],
    ]);
    expect(edges.every((e) => e.type === "default" && e.label === undefined)).toBe(true);
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

  it("draws one edge per case from the case's handle for restaurant_reservation", () => {
    const { nodes, edges } = configToGraph(restaurantReservation);
    expect(nodes.map((n) => n.type)).not.toContain("decision");
    const branchEdges = edges.filter((e) => e.source === "get_time");
    expect(
      branchEdges.map((e) => [e.sourceHandle, e.target, e.data?.kind, e.data?.caseIndex])
    ).toEqual([
      ["fn:check_availability:case:available", "confirm", "case", 0],
      ["fn:check_availability:case:unavailable", "no_availability", "case", 1],
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
    expect(edges.map((e) => [e.id, e.sourceHandle, e.target, e.type])).toEqual([
      ["edge:a:f:case:x", "fn:f:case:x", "b", "default"],
      ["edge:a:f:default", "fn:f:default", "a", "selfloop"],
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
    expect(edges.some((e) => e.sourceHandle?.includes("get_delivery_estimate"))).toBe(false);
  });

  it("round-trips handle ids, including case values with the separator", () => {
    const refs = [
      { kind: "function", functionName: "f" },
      { kind: "case", functionName: "f", caseValue: "a:b" },
      { kind: "default", functionName: "f" },
      { kind: "new-case", functionName: "f" },
      { kind: "new-function" },
    ] as const;
    for (const ref of refs) expect(parseHandleId(handleId(ref))).toEqual(ref);
    expect(parseHandleId(null)).toEqual({ kind: "new-function" });
    expect(parseHandleId("garbage")).toEqual({ kind: "new-function" });
  });
});

describe("layoutNodes", () => {
  it("places every node and keeps sources left of their targets", () => {
    const { nodes, edges } = configToGraph(foodOrdering);
    const placed = layoutNodes(nodes, edges);
    const byId = new Map(placed.map((n) => [n.id, n.position]));
    expect(placed).toHaveLength(nodes.length);
    for (const edge of edges) {
      const source = byId.get(edge.source)!;
      const target = byId.get(edge.target)!;
      if (edge.target === "initial") continue; // the revise_order back edge
      expect(target.x).toBeGreaterThan(source.x);
    }
  });

  it("does not overlap nodes in the same rank", () => {
    const { nodes, edges } = configToGraph(foodOrdering);
    const placed = layoutNodes(nodes, edges);
    const pizza = placed.find((n) => n.id === "choose_pizza")!;
    const sushi = placed.find((n) => n.id === "choose_sushi")!;
    expect(pizza.position.x).toBe(sushi.position.x);
    const gap = Math.abs(pizza.position.y - sushi.position.y);
    expect(gap).toBeGreaterThanOrEqual(estimateNodeSize(pizza).height);
  });

  it("sizes a card by its rows", () => {
    const { nodes } = configToGraph(restaurantReservation);
    const getTime = nodes.find((n) => n.id === "get_time")!;
    const end = nodes.find((n) => n.id === "end")!;
    // check_availability: the function row, two cases, and the add-case row
    expect(estimateNodeSize(getTime).height).toBe(36 + 4 * 24 + 8);
    expect(estimateNodeSize(end).height).toBe(36);
  });

  it("leaves headroom above a card with a self-loop", () => {
    const config: FlowConfig = {
      initial_node: "a",
      nodes: {
        a: {
          task_messages: [],
          functions: [
            { name: "to_b", transition_to: "b" },
            { name: "to_c", transition_to: "c" },
          ],
        },
        b: { task_messages: [], functions: [{ name: "again", transition_to: "b" }] },
        c: { task_messages: [] },
      },
    };
    const { nodes, edges } = configToGraph(config);
    const placed = layoutNodes(nodes, edges);
    const b = placed.find((n) => n.id === "b")!;
    const c = placed.find((n) => n.id === "c")!;
    // b and c share a column; the gap between them includes b's headroom
    expect(b.position.x).toBe(c.position.x);
    const gap = Math.abs(b.position.y - c.position.y);
    expect(gap).toBeGreaterThanOrEqual(estimateNodeSize(b).height + SELF_LOOP_HEADROOM);
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
    const measured = nodes.map((n) => ({ ...n, measured: { width: 400, height: 300 } }));
    const placed = layoutNodes(measured, edges);
    const pizza = placed.find((n) => n.id === "choose_pizza")!;
    const sushi = placed.find((n) => n.id === "choose_sushi")!;
    expect(Math.abs(pizza.position.y - sushi.position.y)).toBeGreaterThanOrEqual(300);
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

  it("keeps a branch's targets as separate edges when positions are stored", () => {
    const { edges } = configToCanvas(restaurantReservation, {
      positions: { get_time: { x: 1, y: 2 } },
    });
    expect(edges.filter((e) => e.source === "get_time")).toHaveLength(2);
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
