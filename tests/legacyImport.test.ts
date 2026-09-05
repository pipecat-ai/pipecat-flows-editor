import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  convertLegacyFlow,
  describeLegacyDrops,
  isLegacyFlowJson,
} from "@/lib/document/legacyImport";
import { validateFlow } from "@/lib/validation/flowConfigValidator";

const legacyFoodOrdering = JSON.parse(
  readFileSync(resolve(__dirname, "fixtures/legacy_food_ordering.json"), "utf8")
);

describe("isLegacyFlowJson", () => {
  it("recognizes the old file and autosave shapes but not a FlowConfig", () => {
    expect(isLegacyFlowJson(legacyFoodOrdering)).toBe(true);
    expect(isLegacyFlowJson({ nodes: [{ id: "a", data: {} }], edges: [] })).toBe(true);
    expect(isLegacyFlowJson({ initial_node: "a", nodes: { a: { task_messages: [] } } })).toBe(
      false
    );
    expect(isLegacyFlowJson(null)).toBe(false);
    expect(isLegacyFlowJson("nodes")).toBe(false);
  });
});

describe("convertLegacyFlow", () => {
  it("converts the old food-ordering example into a valid config with positions", () => {
    const { config, positions, dropped } = convertLegacyFlow(legacyFoodOrdering);
    expect(validateFlow(config).ok).toBe(true);
    expect(config.initial_node).toBe("initial");
    expect(Object.keys(config.nodes)).toEqual(
      legacyFoodOrdering.nodes.map((n: { id: string }) => n.id)
    );
    expect(config.nodes.initial.functions).toEqual([
      { name: "choose_pizza", transition_to: "pizza_task" },
      { name: "choose_sushi", transition_to: "sushi_task" },
    ]);
    expect(typeof config.nodes.initial.role_message).toBe("string");
    expect(positions.initial).toEqual({ x: 100, y: 100 });
    expect(dropped.every((d) => d.kind === "tool_schema")).toBe(true);
    expect(dropped.map((d) => d.kind === "tool_schema" && d.name)).toContain("choose_pizza");
  });

  it("flags decisions, summary prompts, and schemas, and joins role messages", () => {
    const legacy = {
      meta: { name: "x" },
      nodes: [
        {
          id: "start",
          type: "node",
          position: { x: 1, y: 2 },
          data: {
            role_messages: [
              { role: "system", content: "You are helpful." },
              { role: "system", content: "Be brief." },
            ],
            task_messages: [{ role: "system", content: "Ask." }],
            context_strategy: { strategy: "RESET_WITH_SUMMARY", summary_prompt: "Summarize." },
            respond_immediately: false,
            pre_actions: [{ type: "tts_say", text: "Hi", handler: undefined }],
            functions: [
              {
                name: "route",
                description: "",
                next_node_id: "end",
                decision: { action: "result = 1", conditions: [], default_next_node_id: "end" },
              },
              { name: "plain", description: "", next_node_id: "end" },
              { name: "tool", description: "Does work", properties: { a: { type: "string" } } },
            ],
          },
        },
        {
          id: "end",
          type: "end",
          position: { x: 3, y: 4 },
          data: { post_actions: [{ type: "end_conversation" }] },
        },
      ],
      edges: [],
      global_functions: [{ name: "help", description: "Help", timeout_secs: 5 }],
    };
    const { config, dropped } = convertLegacyFlow(legacy);
    expect(config.initial_node).toBe("start");
    expect(config.nodes.start).toEqual({
      role_message: "You are helpful.\n\nBe brief.",
      task_messages: [{ role: "system", content: "Ask." }],
      pre_actions: [{ type: "tts_say", text: "Hi" }],
      functions: [{ name: "route" }, { name: "plain", transition_to: "end" }, { name: "tool" }],
      context_strategy: "reset",
      respond_immediately: false,
    });
    expect(config.global_functions).toEqual([{ name: "help" }]);
    expect(dropped).toEqual([
      { kind: "decision", name: "route", node: "start" },
      { kind: "tool_schema", name: "tool" },
      { kind: "summary_prompt", node: "start" },
      { kind: "tool_schema", name: "help" },
    ]);
    expect(describeLegacyDrops(dropped)).toBe(
      "Tool schemas now belong in the tools module; dropped for 'tool', 'help'. " +
        "Decisions need a branch table; left without a destination: 'route on start'. " +
        "RESET_WITH_SUMMARY became reset; summary prompt dropped on 'start'."
    );
    expect(validateFlow(config).ok).toBe(true);
  });

  it("converts the old autosave shape without meta", () => {
    const { config } = convertLegacyFlow({
      nodes: [{ id: "a", type: "initial", position: { x: 0, y: 0 }, data: { task_messages: [] } }],
    });
    expect(config).toEqual({ initial_node: "a", nodes: { a: { task_messages: [] } } });
  });
});
