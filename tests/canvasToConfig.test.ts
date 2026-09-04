import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import { deriveCanvasGraph, reconcileEdges } from "@/lib/convert/canvasGraph";
import { canvasToConfig, configNodeFromData } from "@/lib/convert/canvasToConfig";
import {
  branchNodeId,
  type CanvasNode,
  type ConfigCanvasNode,
  configToCanvas,
} from "@/lib/convert/configToCanvas";
import type { FlowConfig } from "@/lib/schema/flowConfig";

function loadExample(name: string): FlowConfig {
  return parse(readFileSync(resolve(__dirname, "../public/examples", name), "utf8"));
}

const foodOrdering = loadExample("food_ordering.yaml");
const restaurantReservation = loadExample("restaurant_reservation.yaml");

const configNode = (
  id: string,
  type: ConfigCanvasNode["type"],
  data: object
): ConfigCanvasNode => ({
  id,
  type,
  position: { x: 0, y: 0 },
  data: { label: id, name: id, type, task_messages: [], ...data },
});

describe("canvasToConfig", () => {
  it("round-trips Pipecat's examples", () => {
    for (const config of [foodOrdering, restaurantReservation]) {
      const canvas = configToCanvas(config);
      expect(canvasToConfig(canvas.nodes, config.global_functions)).toEqual(config);
    }
  });

  it("takes initial_node from the node displayed as initial", () => {
    const nodes = [configNode("a", "node", {}), configNode("b", "initial", {})];
    expect(canvasToConfig(nodes).initial_node).toBe("b");
  });

  it("leaves initial_node empty when no node is initial", () => {
    expect(canvasToConfig([configNode("a", "node", {})]).initial_node).toBe("");
  });

  it("strips canvas-only fields and defaults", () => {
    const node = configNodeFromData({
      label: "a",
      name: "a",
      type: "node",
      task_messages: [],
      role_message: "",
      functions: [],
      pre_actions: [],
      post_actions: [],
      context_strategy: null,
      respond_immediately: true,
      stray: 1,
    });
    expect(node).toEqual({ task_messages: [] });
  });

  it("keeps non-default fields and drops unset destinations", () => {
    const node = configNodeFromData({
      label: "a",
      name: "a",
      type: "node",
      task_messages: [{ role: "developer", content: "x" }],
      functions: [
        { name: "stay", transition_to: null },
        { name: "go", transition_to: "b" },
        { name: "branch", transition_to: { field: "k", cases: { x: "b" }, default: null } },
      ],
      post_actions: [{ type: "tts_say", text: "Bye", handler: null }],
      context_strategy: "reset",
      respond_immediately: false,
    });
    expect(node).toEqual({
      task_messages: [{ role: "developer", content: "x" }],
      functions: [
        { name: "stay" },
        { name: "go", transition_to: "b" },
        { name: "branch", transition_to: { field: "k", cases: { x: "b" } } },
      ],
      post_actions: [{ type: "tts_say", text: "Bye" }],
      context_strategy: "reset",
      respond_immediately: false,
    });
  });
});

describe("deriveCanvasGraph", () => {
  const branchFn = { name: "check", transition_to: { field: "s", cases: { ok: "b" } } };

  it("adds a branch node below its source and derives the edges", () => {
    const nodes: CanvasNode[] = [
      { ...configNode("a", "initial", { functions: [branchFn] }), position: { x: 10, y: 20 } },
      configNode("b", "node", {}),
    ];
    const derived = deriveCanvasGraph(nodes);
    expect(derived.nodesChanged).toBe(true);
    const branch = derived.nodes.find((n) => n.id === branchNodeId("a", "check"))!;
    expect(branch.type).toBe("decision");
    expect(branch.position).toEqual({ x: 10, y: 120 });
    expect(derived.edges.map((e) => [e.source, e.target])).toEqual([
      ["a", branch.id],
      [branch.id, "b"],
    ]);
  });

  it("is stable once the branch node exists", () => {
    const nodes: CanvasNode[] = [configNode("a", "initial", { functions: [branchFn] })];
    const once = deriveCanvasGraph(nodes);
    const twice = deriveCanvasGraph(once.nodes);
    expect(twice.nodesChanged).toBe(false);
    expect(twice.nodes).toBe(once.nodes === twice.nodes ? once.nodes : twice.nodes);
    expect(twice.nodes[1]).toBe(once.nodes[1]);
  });

  it("keeps a moved branch node's position and updates its data", () => {
    const nodes: CanvasNode[] = [configNode("a", "initial", { functions: [branchFn] })];
    const once = deriveCanvasGraph(nodes);
    const moved = once.nodes.map((n) =>
      n.type === "decision" ? { ...n, position: { x: 500, y: 500 } } : n
    );
    const withDefault = moved.map((n) =>
      n.id === "a"
        ? {
            ...n,
            data: {
              ...n.data,
              functions: [
                { ...branchFn, transition_to: { ...branchFn.transition_to, default: "a" } },
              ],
            },
          }
        : n
    ) as CanvasNode[];
    const derived = deriveCanvasGraph(withDefault);
    const branch = derived.nodes.find((n) => n.type === "decision")!;
    expect(derived.nodesChanged).toBe(true);
    expect(branch.position).toEqual({ x: 500, y: 500 });
    expect(branch.data.hasDefault).toBe(true);
  });

  it("removes a branch node whose function lost its branch table", () => {
    const nodes: CanvasNode[] = [configNode("a", "initial", { functions: [branchFn] })];
    const once = deriveCanvasGraph(nodes);
    const cleared = once.nodes.map((n) =>
      n.id === "a" ? { ...n, data: { ...n.data, functions: [{ name: "check" }] } } : n
    ) as CanvasNode[];
    const derived = deriveCanvasGraph(cleared);
    expect(derived.nodesChanged).toBe(true);
    expect(derived.nodes.map((n) => n.id)).toEqual(["a"]);
    expect(derived.edges).toEqual([]);
  });
});

describe("reconcileEdges", () => {
  const edge = (id: string, target: string) => ({ id, source: "a", target, label: id });

  it("returns the current edges when nothing changed", () => {
    const current = [edge("x", "b")];
    expect(reconcileEdges(current, [edge("x", "b")])).toEqual({ changed: false, edges: current });
  });

  it("keeps selection when an edge changes", () => {
    const current = [{ ...edge("x", "b"), selected: true }, edge("y", "b")];
    const result = reconcileEdges(current, [edge("x", "c"), edge("y", "b")]);
    expect(result.changed).toBe(true);
    expect(result.edges[0]).toMatchObject({ target: "c", selected: true });
  });
});
