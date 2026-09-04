import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import { deriveCanvasEdges, reconcileEdges } from "@/lib/convert/canvasGraph";
import { canvasToConfig, configNodeFromData } from "@/lib/convert/canvasToConfig";
import {
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

describe("deriveCanvasEdges", () => {
  const branchFn = { name: "check", transition_to: { field: "s", cases: { ok: "b" } } };

  it("derives an edge per destination from the row's handle", () => {
    const nodes: CanvasNode[] = [
      configNode("a", "initial", { functions: [branchFn, { name: "go", transition_to: "b" }] }),
      configNode("b", "node", {}),
    ];
    expect(deriveCanvasEdges(nodes).map((e) => [e.sourceHandle, e.target])).toEqual([
      ["fn:check:case:ok", "b"],
      ["fn:go", "b"],
    ]);
  });

  it("drops the edges of a function that lost its destination", () => {
    const nodes: CanvasNode[] = [configNode("a", "initial", { functions: [{ name: "check" }] })];
    expect(deriveCanvasEdges(nodes)).toEqual([]);
  });
});

describe("reconcileEdges", () => {
  const edge = (id: string, target: string) => ({
    id,
    source: "a",
    sourceHandle: `fn:${id}`,
    target,
  });

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
