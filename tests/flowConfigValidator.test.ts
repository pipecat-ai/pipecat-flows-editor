import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import type { FlowConfig } from "@/lib/schema/flowConfig";
import {
  checkFlowConfigReferences,
  checkFlowGraph,
  validateFlow,
  validateFlowConfigSchema,
} from "@/lib/validation/flowConfigValidator";
import { type FlowIssue, summarizeIssues } from "@/lib/validation/flowIssues";

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

const codes = (issues: FlowIssue[], level?: string) =>
  issues.filter((i) => level === undefined || i.level === level).map((i) => i.code);

/** Pipecat's own good config from tests/test_flows_validation.py. */
const GOOD = parse(`
initial_node: start
nodes:
  start:
    role_message: You work for {{ restaurant }}.
    task_messages:
      - role: developer
        content: Greet {{ caller }}.
    pre_actions:
      - type: function
        handler: check_kitchen
    functions:
      - name: choose_pizza
        transition_to: pizza
  pizza:
    task_messages:
      - role: developer
        content: Take the order.
    functions:
      - name: report_status
        transition_to:
          field: status
          cases:
            ok: end
            retry: pizza
  end:
    task_messages:
      - role: developer
        content: Bye, {{ caller }}.
    post_actions:
      - type: tts_say
        text: Thanks {{ caller }}!
      - type: end_conversation
global_functions:
  - name: finish
    transition_to: end
`);

describe("validateFlow report", () => {
  it("accepts Pipecat's good config and inventories it", () => {
    const report = validateFlow(GOOD);
    expect(report.ok).toBe(true);
    expect(report.issues).toEqual([]);
    expect(report.tools).toEqual(["check_kitchen", "choose_pizza", "finish", "report_status"]);
    expect(report.variables).toEqual(["caller", "restaurant"]);
    expect(report.config).not.toBeNull();
  });

  it("accepts Pipecat's example configs", () => {
    expect(validateFlow(foodOrdering).ok).toBe(true);
    expect(validateFlow(restaurantReservation).issues).toEqual([]);
  });

  it("reports every field error as a schema issue naming its location", () => {
    const report = validateFlow(
      parse("initial_node: a\nnodes:\n  a:\n    task_messages: []\n    bogus: 1\n    other: 2\n")
    );
    expect(report.ok).toBe(false);
    expect(codes(report.issues)).toEqual(["schema", "schema"]);
    expect(report.issues[0].message).toBe("nodes.a.bogus: unknown key");
    expect(report.issues[1].message).toBe("nodes.a.other: unknown key");
    expect(report.issues[0].node).toBe("a");
    expect(report.tools).toEqual([]);
  });

  it("reports a missing field the way Pydantic locates it", () => {
    const report = validateFlow(parse("initial_node: a\nnodes:\n  a:\n    functions: []\n"));
    expect(report.issues.map((i) => i.message)).toEqual(["nodes.a.task_messages: field required"]);
  });

  it("names the reference in graph errors, as schema issues", () => {
    const report = validateFlow(
      parse("initial_node: missing\nnodes:\n  a:\n    task_messages: []\n")
    );
    expect(codes(report.issues)).toEqual(["schema"]);
    expect(report.issues[0].message).toContain("initial_node 'missing'");
    expect(report.ok).toBe(false);
    expect(report.config).not.toBeNull();
  });

  it("holds graph warnings until the config has no errors", () => {
    const config = minimal();
    config.nodes.orphan = { task_messages: [] };
    config.nodes.start.functions = [{ name: "go", transition_to: "nowhere" }];
    expect(codes(validateFlow(config).issues)).toEqual(["schema"]);
  });

  it("summarizes counts for a toast", () => {
    expect(summarizeIssues([])).toBe("");
    expect(
      summarizeIssues([
        { level: "error", code: "schema", message: "" },
        { level: "warning", code: "dead_end", message: "" },
        { level: "warning", code: "dead_end", message: "" },
      ])
    ).toBe("1 error and 2 warnings");
  });
});

describe("schema validation", () => {
  it("rejects unknown keys, mirroring extra='forbid'", () => {
    const config = minimal() as unknown as Record<string, unknown>;
    config.meta = { name: "x" };
    const result = validateFlowConfigSchema(config);
    expect(result.valid).toBe(false);
    expect(result.issues[0].message).toBe("meta: unknown key");
  });

  it("rejects unknown keys on a node, but passes extra keys on an action through", () => {
    const withNodeKey = minimal();
    (withNodeKey.nodes.start as unknown as Record<string, unknown>).position = { x: 1, y: 2 };
    expect(validateFlowConfigSchema(withNodeKey).valid).toBe(false);

    const withActionKey = minimal();
    withActionKey.nodes.end.post_actions = [{ type: "tts_say", text: "Bye" }];
    expect(validateFlowConfigSchema(withActionKey).valid).toBe(true);
  });

  it("requires initial_node and at least one node", () => {
    expect(validateFlowConfigSchema({ nodes: minimal().nodes }).valid).toBe(false);
    expect(validateFlowConfigSchema({ initial_node: "a", nodes: {} }).valid).toBe(false);
  });

  it("requires a field and at least one case on a branch", () => {
    const config = minimal();
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

describe("reference checks", () => {
  it("passes Pipecat's example configs", () => {
    expect(checkFlowConfigReferences(foodOrdering as FlowConfig)).toEqual([]);
    expect(checkFlowConfigReferences(restaurantReservation as FlowConfig)).toEqual([]);
  });

  it("requires initial_node to name a node", () => {
    const config = minimal();
    config.initial_node = "missing";
    expect(checkFlowConfigReferences(config)).toEqual([
      {
        level: "error",
        code: "schema",
        message: "initial_node 'missing' is not a defined node",
        instancePath: "/initial_node",
      },
    ]);
  });

  it("requires every destination to name a node, including branch cases and defaults", () => {
    const config = minimal();
    config.nodes.start.functions = [
      { name: "go", transition_to: "nowhere" },
      {
        name: "check",
        transition_to: { field: "status", cases: { ok: "end", bad: "lost" }, default: "gone" },
      },
    ];
    expect(checkFlowConfigReferences(config).map((e) => [e.message, e.node, e.function])).toEqual([
      ["node 'start' function 'go' transitions to unknown node 'nowhere'", "start", "go"],
      ["node 'start' function 'check' transitions to unknown node 'lost'", "start", "check"],
      ["node 'start' function 'check' transitions to unknown node 'gone'", "start", "check"],
    ]);
  });

  it("checks global function destinations", () => {
    const config = minimal();
    config.global_functions = [{ name: "help", transition_to: "nowhere" }];
    expect(checkFlowConfigReferences(config)[0]).toMatchObject({
      message: "global_functions function 'help' transitions to unknown node 'nowhere'",
      function: "help",
      instancePath: "/global_functions/0/transition_to",
    });
  });

  it("rejects duplicate names, with Pydantic's location prefix for a node's validator", () => {
    const config = minimal();
    config.nodes.start.functions = [{ name: "finish" }, { name: "finish" }];
    config.global_functions = [{ name: "help" }, { name: "help" }];
    expect(checkFlowConfigReferences(config).map((e) => e.message)).toEqual([
      "duplicate function 'help' in global_functions",
      "nodes.start: duplicate function 'finish' in node",
    ]);
  });

  it("allows the same function name on different nodes", () => {
    expect(checkFlowConfigReferences(restaurantReservation as FlowConfig)).toEqual([]);
  });

  it("rejects a node function that is also a global function", () => {
    const config = minimal();
    config.global_functions = [{ name: "finish" }];
    expect(checkFlowConfigReferences(config)[0].message).toBe(
      "node 'start' function 'finish' is also a global function"
    );
  });

  it("requires a handler on function actions and forbids it elsewhere, located like Pydantic", () => {
    const config = minimal();
    config.nodes.start.pre_actions = [{ type: "function" }];
    config.nodes.end.post_actions = [{ type: "end_conversation", handler: "x" }];
    expect(checkFlowConfigReferences(config).map((e) => e.message)).toEqual([
      "nodes.start.pre_actions.0: a 'function' action requires a 'handler' name",
      "nodes.end.post_actions.0: action type 'end_conversation' does not take a 'handler'; register custom action types with FlowManager.register_action",
    ]);
  });

  it("escapes node names in instance paths", () => {
    const config = minimal();
    config.nodes["a/b"] = { task_messages: [], functions: [{ name: "x", transition_to: "no" }] };
    expect(checkFlowConfigReferences(config)[0].instancePath).toBe(
      "/nodes/a~1b/functions/0/transition_to"
    );
  });
});

// Ported from TestGraphWarnings in Pipecat's tests/test_flows_validation.py
describe("graph warnings", () => {
  const node = (extra: object = {}) => ({
    task_messages: [{ role: "developer", content: "x" }],
    ...extra,
  });
  const ending = { post_actions: [{ type: "end_conversation" }] };

  it("flags an unreachable node", () => {
    const report = validateFlow({
      initial_node: "a",
      nodes: { a: node(ending), orphan: node(ending) },
    });
    expect(report.ok).toBe(true);
    expect(codes(report.issues)).toEqual(["unreachable_node"]);
    expect(report.issues[0]).toMatchObject({
      level: "warning",
      node: "orphan",
      message: "node 'orphan' cannot be reached from 'a'",
      instancePath: "/nodes/orphan",
    });
  });

  it("counts a global function as reaching its target", () => {
    const report = validateFlow({
      initial_node: "a",
      nodes: { a: node(), end: node(ending) },
      global_functions: [{ name: "finish", transition_to: "end" }],
    });
    expect(report.issues).toEqual([]);
  });

  it("flags a dead end", () => {
    const report = validateFlow({
      initial_node: "a",
      nodes: {
        a: node({ functions: [{ name: "choose_pizza", transition_to: "b" }] }),
        b: node({ functions: [{ name: "report_status" }] }),
      },
    });
    expect(codes(report.issues)).toEqual(["dead_end"]);
    expect(report.issues[0]).toMatchObject({
      node: "b",
      message: "node 'b' has no function that leaves it and does not end the conversation",
    });
  });

  it("treats a self-loop alone as a dead end", () => {
    const report = validateFlow({
      initial_node: "a",
      nodes: { a: node({ functions: [{ name: "again", transition_to: "a" }] }) },
    });
    expect(codes(report.issues)).toEqual(["dead_end"]);
  });

  it("does not flag an end node", () => {
    expect(validateFlow({ initial_node: "a", nodes: { a: node(ending) } }).issues).toEqual([]);
  });

  it("flags a branch whose every case leads one place", () => {
    const report = validateFlow({
      initial_node: "a",
      nodes: {
        a: node({
          functions: [
            {
              name: "report_status",
              transition_to: { field: "status", cases: { ok: "b", meh: "b" }, default: "b" },
            },
          ],
        }),
        b: node(ending),
      },
    });
    expect(codes(report.issues)).toEqual(["branch_single_target"]);
    expect(report.issues[0]).toMatchObject({
      node: "a",
      function: "report_status",
      message:
        "node 'a' function 'report_status' branches on 'status' but every case and the default lead to 'b'",
      instancePath: "/nodes/a/functions/0/transition_to",
    });
  });

  it("does not flag a single case without a default: staying on the node is the other outcome", () => {
    const report = validateFlow({
      initial_node: "a",
      nodes: {
        a: node({
          functions: [
            { name: "report_status", transition_to: { field: "status", cases: { ok: "b" } } },
          ],
        }),
        b: node(ending),
      },
    });
    expect(report.issues).toEqual([]);
  });

  it("does not flag a branch whose default differs from its cases", () => {
    const config: FlowConfig = {
      initial_node: "a",
      nodes: {
        a: node({
          functions: [
            { name: "check", transition_to: { field: "s", cases: { ok: "b" }, default: "a" } },
          ],
        }),
        b: node(ending),
      },
    };
    expect(checkFlowGraph(config)).toEqual([]);
  });

  it("reports several warnings in Pipecat's order: unreachable, dead end, single target", () => {
    const report = validateFlow({
      initial_node: "a",
      nodes: {
        a: node({
          functions: [
            { name: "f", transition_to: { field: "s", cases: { x: "b" }, default: "b" } },
          ],
        }),
        b: node(),
        c: node(ending),
      },
    });
    expect(codes(report.issues)).toEqual(["unreachable_node", "dead_end", "branch_single_target"]);
  });
});
