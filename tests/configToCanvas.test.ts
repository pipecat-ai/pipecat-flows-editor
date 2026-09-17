import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { beforeEach, describe, expect, it } from "vitest";
import { parse } from "yaml";

import {
  configNodesOf,
  configToCanvas,
  configToGraph,
  decisionNodeId,
  deriveConfigNodeType,
  GLOBAL_NODE_ID,
  isConfigNode,
  isDecisionNode,
  parseDecisionNodeId,
  reconcileDecisionNodes,
  withGlobalNode,
} from "@/lib/convert/configToCanvas";
import {
  estimateNodeSize,
  layoutGraph,
  layoutNodes,
  loopClearance,
  NODE_CARD,
} from "@/lib/layout/autoLayout";
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
  it("maps food_ordering to one node per config node and one labeled edge per transition", () => {
    const { nodes, edges } = configToGraph(foodOrdering);
    expect(nodes.map((n) => [n.id, n.type])).toEqual([
      ["initial", "initial"],
      ["choose_pizza", "node"],
      ["choose_sushi", "node"],
      ["confirm", "node"],
      ["end", "end"],
      [GLOBAL_NODE_ID, "global"],
    ]);
    expect(edges.map((e) => [e.source, e.target, e.label])).toEqual([
      ["initial", "choose_pizza", "choose_pizza"],
      ["initial", "choose_sushi", "choose_sushi"],
      ["choose_pizza", "confirm", "select_pizza_order"],
      ["choose_sushi", "confirm", "select_sushi_order"],
      ["confirm", "end", "complete_order"],
      ["confirm", "initial", "revise_order"],
    ]);
    // Every edge leaves a card's one exit and enters the next card's one entry
    expect(
      edges.every(
        (e) =>
          e.type === "labeled" &&
          e.sourceHandle === "out" &&
          e.targetHandle === "in" &&
          e.markerEnd === "url(#flow-arrow)"
      )
    ).toBe(true);
  });

  it("carries the config node's fields and name onto the canvas node data", () => {
    const { nodes } = configToGraph(foodOrdering);
    const initial = configNodesOf(nodes).find((n) => n.id === "initial")!;
    expect(initial.data.name).toBe("initial");
    expect(initial.data.label).toBe("initial");
    expect(initial.data.type).toBe("initial");
    expect(initial.data.role_message).toBe(foodOrdering.nodes.initial.role_message);
    expect(initial.data.task_messages).toEqual(foodOrdering.nodes.initial.task_messages);
    expect(initial.data.functions).toEqual(foodOrdering.nodes.initial.functions);
    expect(initial.data.pre_actions).toEqual(foodOrdering.nodes.initial.pre_actions);
  });

  it("draws a branch as a decision node with one edge in and one edge per case out", () => {
    const { nodes, edges } = configToGraph(restaurantReservation);
    const decisions = nodes.filter(isDecisionNode);
    expect(decisions.map((n) => n.id)).toEqual([
      decisionNodeId("get_time", 0),
      decisionNodeId("no_availability", 0),
    ]);
    expect(decisions[0].data).toMatchObject({
      sourceNodeId: "get_time",
      functionIndex: 0,
      functionName: "check_availability",
      field: "status",
      caseValues: ["available", "unavailable"],
      hasDefault: false,
    });
    const into = edges.filter((e) => e.source === "get_time");
    expect(into.map((e) => [e.target, e.label, e.data?.kind])).toEqual([
      [decisionNodeId("get_time", 0), "check_availability", "branch"],
    ]);
    const outOf = edges.filter((e) => e.source === decisionNodeId("get_time", 0));
    expect(outOf.map((e) => [e.target, e.label, e.data?.kind, e.data?.caseIndex])).toEqual([
      ["confirm", "available", "case", 0],
      ["no_availability", "unavailable", "case", 1],
    ]);
    // Every edge of the branch names the function on its source node
    expect([...into, ...outOf].every((e) => e.data?.sourceNodeId === "get_time")).toBe(true);
  });

  it("adds a default edge when the branch has one, back to the source if need be", () => {
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
    const { nodes, edges } = configToGraph(config);
    const decision = decisionNodeId("a", 0);
    expect(nodes.find((n) => n.id === decision)?.data).toMatchObject({ hasDefault: true });
    expect(edges.map((e) => [e.id, e.source, e.target, e.label, e.type])).toEqual([
      ["edge:a:0", "a", decision, "f", "labeled"],
      ["edge:a:0:case:x", decision, "b", "x", "labeled"],
      ["edge:a:0:default", decision, "a", "default", "labeled"],
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
      label: "again",
    });
  });

  it("draws no edge for a function without a destination, and the global functions as one card", () => {
    const { nodes, edges } = configToGraph(foodOrdering);
    expect(foodOrdering.global_functions).toEqual([{ name: "get_delivery_estimate" }]);
    expect(nodes).toHaveLength(6);
    expect(edges).toHaveLength(6);
    const global = nodes.find((n) => n.id === GLOBAL_NODE_ID)!;
    expect(global.type).toBe("global");
    expect(global.data.functions).toEqual([{ name: "get_delivery_estimate" }]);
    expect(configNodesOf(nodes)).toHaveLength(5);
  });

  it("has no global card when there are no global functions", () => {
    const { nodes } = configToGraph(restaurantReservation);
    expect(nodes.some((n) => n.id === GLOBAL_NODE_ID)).toBe(false);
  });

  it("numbers edges that share a source and target so they can be drawn apart", () => {
    const config: FlowConfig = {
      initial_node: "a",
      nodes: {
        a: {
          task_messages: [],
          functions: [
            { name: "one", transition_to: "b" },
            { name: "two", transition_to: "b" },
            { name: "elsewhere", transition_to: "c" },
          ],
        },
        b: { task_messages: [] },
        c: { task_messages: [] },
      },
    };
    const { edges } = configToGraph(config);
    expect(edges.map((e) => [e.data?.parallelIndex, e.data?.parallelCount])).toEqual([
      [0, 2],
      [1, 2],
      [undefined, undefined],
    ]);
    // The two into b also share an entry, so their labels stack
    expect(edges.map((e) => [e.data?.inboundIndex, e.data?.inboundCount])).toEqual([
      [0, 2],
      [1, 2],
      [undefined, undefined],
    ]);
  });

  it("numbers edges that share an entry from different sources too", () => {
    const { edges } = configToGraph(foodOrdering);
    const intoConfirm = edges.filter((e) => e.target === "confirm");
    expect(intoConfirm.map((e) => [e.source, e.data?.inboundIndex, e.data?.inboundCount])).toEqual([
      ["choose_pizza", 0, 2],
      ["choose_sushi", 1, 2],
    ]);
  });

  it("round-trips decision node ids, including source names with the separator", () => {
    expect(parseDecisionNodeId(decisionNodeId("a:b", 3))).toEqual({
      sourceNodeId: "a:b",
      functionIndex: 3,
    });
    expect(parseDecisionNodeId("garbage")).toBeNull();
    expect(parseDecisionNodeId("decision:x:a")).toBeNull();
    expect(parseDecisionNodeId("a")).toBeNull();
  });
});

describe("reconcileDecisionNodes", () => {
  it("returns the same array when the decisions already match the config nodes", () => {
    const { nodes } = configToGraph(restaurantReservation);
    expect(reconcileDecisionNodes(nodes)).toBe(nodes);
  });

  it("keeps a decision node's position when its branch changes, and drops it when the branch goes", () => {
    const { nodes } = configToCanvas(restaurantReservation);
    const id = decisionNodeId("get_time", 0);
    const moved = nodes.map((n) => (n.id === id ? { ...n, position: { x: 7, y: 9 } } : n));
    const retargeted = moved.map((n) =>
      n.id === "get_time" && isConfigNode(n)
        ? {
            ...n,
            data: {
              ...n.data,
              functions: [
                {
                  name: "check_availability",
                  transition_to: { field: "status", cases: { available: "confirm" } },
                },
              ],
            },
          }
        : n
    );
    const reconciled = reconcileDecisionNodes(retargeted);
    const decision = reconciled.find((n) => n.id === id)!;
    expect(decision.position).toEqual({ x: 7, y: 9 });
    expect(isDecisionNode(decision) && decision.data.caseValues).toEqual(["available"]);

    const unbranched = retargeted.map((n) =>
      n.id === "get_time" && isConfigNode(n)
        ? { ...n, data: { ...n.data, functions: [{ name: "check_availability" }] } }
        : n
    );
    expect(reconcileDecisionNodes(unbranched).some((n) => n.id === id)).toBe(false);
  });
});

describe("withGlobalNode", () => {
  it("adds the global card, keeps its place while its functions change, and removes it with them", () => {
    const { nodes } = configToCanvas(restaurantReservation);
    expect(withGlobalNode(nodes, [])).toBe(nodes);
    const help = { name: "help" };
    const added = withGlobalNode(nodes, [help]);
    const card = added.find((n) => n.id === GLOBAL_NODE_ID)!;
    expect(card.type).toBe("global");
    expect(card.data.functions).toEqual([help]);
    // Above and to the left of the flow
    expect(card.position.x).toBeLessThan(Math.min(...nodes.map((n) => n.position.x)));
    expect(withGlobalNode(added, [help])).toBe(added);

    const moved = added.map((n) =>
      n.id === GLOBAL_NODE_ID ? { ...n, position: { x: 3, y: 4 } } : n
    );
    const renamed = withGlobalNode(moved, [{ name: "assist", transition_to: "end" }]);
    const after = renamed.find((n) => n.id === GLOBAL_NODE_ID)!;
    expect(after.position).toEqual({ x: 3, y: 4 });
    expect(after.data.functions).toEqual([{ name: "assist", transition_to: "end" }]);
    expect(configNodesOf(renamed)).toEqual(configNodesOf(nodes));

    expect(withGlobalNode(renamed, []).some((n) => n.id === GLOBAL_NODE_ID)).toBe(false);
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

  it("puts a decision node between its source and its targets", () => {
    const { nodes, edges } = configToGraph(restaurantReservation);
    const placed = layoutNodes(nodes, edges);
    const byId = new Map(placed.map((n) => [n.id, n.position]));
    const decision = byId.get(decisionNodeId("get_time", 0))!;
    expect(decision.y).toBeGreaterThan(byId.get("get_time")!.y);
    expect(byId.get("confirm")!.y).toBeGreaterThan(decision.y);
  });

  it("sizes a card by its description and the functions that stay on it, not by its transitions", () => {
    const { nodes } = configToGraph(restaurantReservation);
    const getTime = nodes.find((n) => n.id === "get_time")!;
    const end = nodes.find((n) => n.id === "end")!;
    // check_availability is a branch, drawn as edges and a decision node; the
    // card shows the header and two lines of the first task message
    expect(estimateNodeSize(getTime).height).toBe(36 + 40);
    expect(estimateNodeSize(end).height).toBe(36 + 40);
    const staying = configToGraph({
      initial_node: "a",
      nodes: { a: { task_messages: [], functions: [{ name: "lookup" }, { name: "note" }] } },
    }).nodes[0];
    expect(estimateNodeSize(staying).height).toBe(36 + 2 * 24 + 8);
    const decision = nodes.find(isDecisionNode)!;
    expect(estimateNodeSize(decision)).toEqual({ width: 120, height: 44 });
  });

  it("draws an end node with nothing but the end as a small pill", () => {
    const { nodes } = configToGraph({
      initial_node: "a",
      nodes: {
        a: { task_messages: [], functions: [{ name: "go", transition_to: "end" }] },
        end: { task_messages: [], post_actions: [{ type: "end_conversation" }] },
        bye: {
          task_messages: [{ role: "developer", content: "Say goodbye." }],
          post_actions: [{ type: "end_conversation" }],
        },
      },
    });
    expect(estimateNodeSize(nodes.find((n) => n.id === "end")!)).toEqual({
      width: 160,
      height: 36,
    });
    expect(estimateNodeSize(nodes.find((n) => n.id === "bye")!)).toEqual({
      width: 280,
      height: 76,
    });
  });

  it("keeps a card with a self-loop centered on its column", () => {
    const config: FlowConfig = {
      initial_node: "a",
      nodes: {
        a: { task_messages: [], functions: [{ name: "to_b", transition_to: "b" }] },
        b: {
          task_messages: [],
          functions: [
            { name: "again", transition_to: "b" },
            { name: "to_c", transition_to: "c" },
          ],
        },
        c: { task_messages: [] },
      },
    };
    const { nodes, edges } = configToGraph(config);
    const placed = layoutNodes(nodes, edges);
    const centerX = (id: string) => {
      const node = placed.find((n) => n.id === id)!;
      return node.position.x + estimateNodeSize(node).width / 2;
    };
    expect(centerX("b")).toBeCloseTo(centerX("a"));
    expect(centerX("c")).toBeCloseTo(centerX("a"));
  });

  it("leaves room beside a card with a self-loop", () => {
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
    // b and c share a rank; the gap between them has room for b's loop and its label
    expect(b.position.y).toBe(c.position.y);
    const gap = Math.abs(b.position.x - c.position.x);
    expect(gap).toBeGreaterThanOrEqual(estimateNodeSize(b).width + loopClearance("again"));
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
    expect(Math.abs(pizza.position.x - sushi.position.x)).toBeGreaterThanOrEqual(400);
  });
});

describe("layoutGraph routes", () => {
  const config: FlowConfig = {
    initial_node: "a",
    nodes: {
      a: {
        task_messages: [],
        functions: [{ name: "f", transition_to: { field: "k", cases: { x: "b", y: "c" } } }],
      },
      b: { task_messages: [], functions: [{ name: "g", transition_to: "c" }] },
      c: { task_messages: [], post_actions: [{ type: "end_conversation" }] },
    },
  };

  it("routes a long edge beside the node between its ranks, with a label slot for every edge", () => {
    const { nodes, edges } = configToGraph(config);
    const { nodes: placed, routes } = layoutGraph(nodes, edges);
    const b = placed.find((n) => n.id === "b")!;
    const long = edges.find((e) => e.source === decisionNodeId("a", 0) && e.target === "c")!;
    const waypoints = routes[long.id].points.slice(1, -1);
    expect(waypoints.length).toBeGreaterThanOrEqual(1);
    // The waypoints keep the edge out of b's column
    for (const point of waypoints) {
      const inside = point.x > b.position.x && point.x < b.position.x + NODE_CARD.width;
      const alongside = point.y > b.position.y && point.y < b.position.y + 76;
      expect(inside && alongside).toBe(false);
    }
    for (const edge of edges) {
      const route = routes[edge.id];
      expect(route.label!.y).toBeGreaterThan(route.source.y);
      expect(route.label!.y).toBeLessThan(route.target.y + 76);
    }
    // Endpoints are recorded where the layout put them
    expect(routes[long.id].target).toEqual(placed.find((n) => n.id === "c")!.position);
  });

  it("hands the routes out with the canvas", () => {
    const canvas = configToCanvas(config);
    expect(Object.keys(canvas.routes!).sort()).toEqual(canvas.edges.map((e) => e.id).sort());
  });
});

describe("configToCanvas", () => {
  it("auto-lays out a config with no stored positions", () => {
    const { nodes } = configToCanvas(foodOrdering);
    const positions = nodes.map((n) => `${n.position.x},${n.position.y}`);
    expect(new Set(positions).size).toBe(nodes.length);
  });

  it("routes a branch's cases as separate edges from the decision node", () => {
    const { edges } = configToCanvas(restaurantReservation);
    expect(edges.filter((e) => e.source === decisionNodeId("get_time", 0))).toHaveLength(2);
  });

  it("applies stored positions over the layout, and keeps the routes from the layout", () => {
    const decision = decisionNodeId("get_time", 0);
    const stored = { initial: { x: 5, y: 7 }, [decision]: { x: 900, y: 900 } };
    const { nodes, routes } = configToCanvas(restaurantReservation, { positions: stored });
    const byId = new Map(nodes.map((n) => [n.id, n.position]));
    expect(byId.get("initial")).toEqual({ x: 5, y: 7 });
    expect(byId.get(decision)).toEqual({ x: 900, y: 900 });
    expect(byId.get("end")).not.toEqual({ x: 0, y: 0 });
    // The routes record where the layout put the endpoints, so an edge can stretch to the stored spot
    expect(routes!["edge:get_time:0"].target).not.toEqual({ x: 900, y: 900 });
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

  it("ignores malformed stored values and arrangements from the horizontal canvas", () => {
    localStorage.setItem("pipecat-flows-editor/positions/v2/bad", '{"a": {"x": "1"}}');
    localStorage.setItem("pipecat-flows-editor/positions/v2/worse", "not json");
    localStorage.setItem("pipecat-flows-editor/positions/old", '{"initial": {"x": 1, "y": 2}}');
    expect(loadPositions("bad")).toEqual({});
    expect(loadPositions("worse")).toEqual({});
    expect(loadPositions("old")).toEqual({});
  });

  it("clears positions for one flow", () => {
    savePositions("food_ordering", { initial: { x: 1, y: 2 } });
    clearPositions("food_ordering");
    expect(loadPositions("food_ordering")).toEqual({});
  });
});
