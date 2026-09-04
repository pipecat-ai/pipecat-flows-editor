import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import type { FlowConfig } from "@/lib/schema/flowConfig";
import {
  checkFlowConfigReferences,
  validateFlowConfig,
  validateFlowConfigSchema,
} from "@/lib/validation/flowConfigValidator";

function loadExample(name: string): unknown {
  return parse(readFileSync(resolve(__dirname, "../public/examples", name), "utf8"));
}

const foodOrdering = loadExample("food_ordering.yaml");
const restaurantReservation = loadExample("restaurant_reservation.yaml");

const minimal = (): FlowConfig => ({
  initial_node: "start",
  nodes: {
    start: {
      task_messages: [{ role: "developer", content: "Say hello." }],
      functions: [{ name: "finish", transition_to: "end" }],
    },
    end: {
      task_messages: [{ role: "developer", content: "Say goodbye." }],
      post_actions: [{ type: "end_conversation" }],
    },
  },
});

describe("flow config schema validation", () => {
  it("accepts Pipecat's example configs", () => {
    expect(validateFlowConfig(foodOrdering)).toMatchObject({ valid: true, errors: [] });
    expect(validateFlowConfig(restaurantReservation)).toMatchObject({ valid: true, errors: [] });
  });

  it("rejects unknown keys, mirroring extra='forbid'", () => {
    const config = minimal() as unknown as Record<string, unknown>;
    config.meta = { name: "x" };
    const result = validateFlowConfigSchema(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.keyword === "additionalProperties")).toBe(true);
  });

  it("rejects unknown keys on a node, but passes extra keys on an action through", () => {
    const withNodeKey = minimal();
    (withNodeKey.nodes.start as unknown as Record<string, unknown>).position = { x: 1, y: 2 };
    expect(validateFlowConfigSchema(withNodeKey).valid).toBe(false);

    const withActionKey = minimal();
    withActionKey.nodes.end.post_actions = [{ type: "tts_say", text: "Bye" }];
    expect(validateFlowConfigSchema(withActionKey).valid).toBe(true);
  });

  it("requires task_messages, initial_node, and at least one node", () => {
    const noTasks = minimal();
    delete (noTasks.nodes.start as Partial<FlowConfig["nodes"][string]>).task_messages;
    expect(validateFlowConfigSchema(noTasks).valid).toBe(false);

    expect(validateFlowConfigSchema({ nodes: minimal().nodes }).valid).toBe(false);
    expect(validateFlowConfigSchema({ initial_node: "a", nodes: {} }).valid).toBe(false);
  });

  it("accepts a branch table and requires a field and at least one case", () => {
    const config = minimal();
    config.nodes.start.functions = [
      { name: "check", transition_to: { field: "status", cases: { ok: "end" }, default: "start" } },
    ];
    expect(validateFlowConfig(config).valid).toBe(true);

    config.nodes.start.functions = [
      { name: "check", transition_to: { field: "status", cases: {} } as never },
    ];
    expect(validateFlowConfigSchema(config).valid).toBe(false);
  });

  it("limits context_strategy to append or reset", () => {
    const config = minimal();
    config.nodes.start.context_strategy = "reset";
    expect(validateFlowConfigSchema(config).valid).toBe(true);
    config.nodes.start.context_strategy = "RESET_WITH_SUMMARY" as never;
    expect(validateFlowConfigSchema(config).valid).toBe(false);
  });
});

describe("flow config reference checks", () => {
  it("passes Pipecat's example configs", () => {
    expect(checkFlowConfigReferences(foodOrdering as FlowConfig)).toEqual([]);
    expect(checkFlowConfigReferences(restaurantReservation as FlowConfig)).toEqual([]);
  });

  it("requires initial_node to name a node", () => {
    const config = minimal();
    config.initial_node = "missing";
    const errors = checkFlowConfigReferences(config);
    expect(errors).toEqual([
      expect.objectContaining({
        instancePath: "/initial_node",
        message: "initial_node 'missing' is not a defined node",
      }),
    ]);
  });

  it("requires every destination to name a node", () => {
    const config = minimal();
    config.nodes.start.functions = [{ name: "go", transition_to: "nowhere" }];
    expect(checkFlowConfigReferences(config)).toEqual([
      expect.objectContaining({
        instancePath: "/nodes/start/functions/0/transition_to",
        message: "node 'start' function 'go' transitions to unknown node 'nowhere'",
      }),
    ]);
  });

  it("checks branch cases and the default", () => {
    const config = minimal();
    config.nodes.start.functions = [
      {
        name: "check",
        transition_to: { field: "status", cases: { ok: "end", bad: "lost" }, default: "gone" },
      },
    ];
    const messages = checkFlowConfigReferences(config).map((e) => e.message);
    expect(messages).toEqual([
      "node 'start' function 'check' transitions to unknown node 'lost'",
      "node 'start' function 'check' transitions to unknown node 'gone'",
    ]);
  });

  it("checks global function destinations", () => {
    const config = minimal();
    config.global_functions = [{ name: "help", transition_to: "nowhere" }];
    expect(checkFlowConfigReferences(config)).toEqual([
      expect.objectContaining({
        instancePath: "/global_functions/0/transition_to",
        message: "global_functions function 'help' transitions to unknown node 'nowhere'",
      }),
    ]);
  });

  it("rejects duplicate function names within a node and in global_functions", () => {
    const config = minimal();
    config.nodes.start.functions = [{ name: "finish" }, { name: "finish" }];
    config.global_functions = [{ name: "help" }, { name: "help" }];
    const errors = checkFlowConfigReferences(config);
    expect(errors.map((e) => [e.instancePath, e.message])).toEqual([
      ["/global_functions/1/name", "duplicate function 'help' in global_functions"],
      ["/nodes/start/functions/1/name", "duplicate function 'finish' in node"],
    ]);
  });

  it("allows the same function name on different nodes", () => {
    expect((restaurantReservation as FlowConfig).nodes.get_time.functions?.[0].name).toBe(
      "check_availability"
    );
    expect((restaurantReservation as FlowConfig).nodes.no_availability.functions?.[0].name).toBe(
      "check_availability"
    );
    expect(checkFlowConfigReferences(restaurantReservation as FlowConfig)).toEqual([]);
  });

  it("rejects a node function that is also a global function", () => {
    const config = minimal();
    config.global_functions = [{ name: "finish" }];
    expect(checkFlowConfigReferences(config)).toEqual([
      expect.objectContaining({
        instancePath: "/nodes/start/functions/0/name",
        message: "node 'start' function 'finish' is also a global function",
      }),
    ]);
  });

  it("requires a handler on function actions and forbids it elsewhere", () => {
    const config = minimal();
    config.nodes.start.pre_actions = [{ type: "function" }];
    config.nodes.end.post_actions = [{ type: "end_conversation", handler: "x" }];
    const errors = checkFlowConfigReferences(config);
    expect(errors.map((e) => [e.instancePath, e.keyword])).toEqual([
      ["/nodes/start/pre_actions/0/handler", "actionHandlerRequired"],
      ["/nodes/end/post_actions/0/handler", "actionHandlerNotAllowed"],
    ]);
  });

  it("escapes node names in instance paths", () => {
    const config = minimal();
    config.nodes["a/b"] = { task_messages: [], functions: [{ name: "x", transition_to: "no" }] };
    expect(checkFlowConfigReferences(config)[0].instancePath).toBe(
      "/nodes/a~1b/functions/0/transition_to"
    );
  });

  it("runs reference checks only after the schema passes", () => {
    const config = minimal() as unknown as Record<string, unknown>;
    config.initial_node = "missing";
    config.extra = true;
    const result = validateFlowConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.every((e) => e.keyword === "additionalProperties")).toBe(true);
  });
});
