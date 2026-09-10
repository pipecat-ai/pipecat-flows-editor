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

  it("writes the opened initial_node when no node is initial, else nothing", () => {
    expect(canvasToConfig([configNode("a", "node", {})]).initial_node).toBe("");
    expect(canvasToConfig([configNode("a", "node", {})], [], "greeting_typo").initial_node).toBe(
      "greeting_typo"
    );
    expect(canvasToConfig([configNode("a", "initial", {})], [], "greeting_typo").initial_node).toBe(
      "a"
    );
  });

  it("strips canvas-only fields and keys the data does not have", () => {
    const node = configNodeFromData({
      label: "a",
      name: "a",
      type: "node",
      task_messages: [],
      stray: 1,
    });
    expect(node).toEqual({ task_messages: [] });
  });

  it("keeps every key the data has, at its default or not, so a written key survives", () => {
    const node = configNodeFromData({
      label: "a",
      name: "a",
      type: "node",
      task_messages: [{ role: "developer", content: "x" }],
      role_message: "",
      functions: [
        { name: "stay", transition_to: null },
        { name: "go", transition_to: "b" },
        { name: "branch", transition_to: { field: "k", cases: { x: "b" }, default: null } },
        { name: "plain" },
      ],
      pre_actions: [],
      post_actions: [{ type: "tts_say", text: "Bye", handler: null }],
      context_strategy: null,
      respond_immediately: true,
    });
    expect(node).toEqual({
      role_message: "",
      task_messages: [{ role: "developer", content: "x" }],
      pre_actions: [],
      functions: [
        { name: "stay", transition_to: null },
        { name: "go", transition_to: "b" },
        { name: "branch", transition_to: { field: "k", cases: { x: "b" }, default: null } },
        { name: "plain" },
      ],
      post_actions: [{ type: "tts_say", text: "Bye", handler: null }],
      context_strategy: null,
      respond_immediately: true,
    });
  });

  it("round-trips a file's explicit defaults through the canvas", () => {
    const config: FlowConfig = {
      initial_node: "a",
      nodes: {
        a: { task_messages: [], functions: [], respond_immediately: true, context_strategy: null },
      },
    };
    expect(canvasToConfig(configToCanvas(config).nodes)).toEqual(config);
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
      ["fn:0:case:ok", "b"],
      ["fn:1", "b"],
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
