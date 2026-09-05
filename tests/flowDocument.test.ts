import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import { configToCanvas } from "@/lib/convert/configToCanvas";
import {
  applyConfigToDocument,
  createFlowDocument,
  flowNameFromFileName,
  parseFlowYaml,
  stringifyFlowDocument,
} from "@/lib/document/flowDocument";
import { serializeFlow } from "@/lib/document/serializeFlow";
import type { FlowConfig } from "@/lib/schema/flowConfig";

const foodOrderingText = readFileSync(
  resolve(__dirname, "../public/examples/food_ordering.yaml"),
  "utf8"
);

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

describe("parseFlowYaml", () => {
  it("parses and validates Pipecat's example", () => {
    const parsed = parseFlowYaml(foodOrderingText);
    expect(parsed.yamlErrors).toEqual([]);
    expect(parsed.issues).toEqual([]);
    expect(parsed.config?.initial_node).toBe("initial");
    expect(parsed.document.commentBefore).toContain("The food-ordering flow as data");
  });

  it("reports YAML syntax errors without a config", () => {
    const parsed = parseFlowYaml("nodes: [\ninitial_node: x");
    expect(parsed.yamlErrors.length).toBeGreaterThan(0);
    expect(parsed.config).toBeNull();
  });

  it("reports schema errors without a config", () => {
    const parsed = parseFlowYaml("initial_node: a\nnodes:\n  a:\n    position: {x: 1}\n");
    expect(parsed.yamlErrors).toEqual([]);
    // The unknown key, and the missing task_messages
    expect(parsed.issues.map((i) => i.code)).toEqual(["schema", "schema"]);
    expect(parsed.config).toBeNull();
  });

  it("returns a config alongside reference errors", () => {
    const parsed = parseFlowYaml("initial_node: missing\nnodes:\n  a:\n    task_messages: []\n");
    expect(parsed.config).not.toBeNull();
    expect(parsed.issues.map((e) => e.message)).toEqual([
      "initial_node 'missing' is not a defined node",
    ]);
  });

  it("accepts JSON, which is YAML", () => {
    const parsed = parseFlowYaml(JSON.stringify(minimal()));
    expect(parsed.config).toEqual(minimal());
  });
});

describe("applyConfigToDocument", () => {
  it("keeps comments and block styles when a value changes", () => {
    const parsed = parseFlowYaml(foodOrderingText);
    const config = structuredClone(parsed.config!);
    config.nodes.initial.functions![0].transition_to = "confirm";
    config.nodes.initial.role_message = config.nodes.initial.role_message!.replace(
      "ALWAYS",
      "always"
    );
    applyConfigToDocument(parsed.document, config);
    const text = stringifyFlowDocument(parsed.document);

    expect(text.startsWith("# The food-ordering flow as data.")).toBe(true);
    expect(text).toContain("role_message: >\n");
    expect(text).toContain("transition_to: confirm\n      - name: choose_sushi");
    expect(parse(text)).toEqual(config);
  });

  it("removes nodes and keys absent from the config and appends new nodes", () => {
    const parsed = parseFlowYaml(foodOrderingText);
    const config = structuredClone(parsed.config!);
    delete config.nodes.choose_sushi;
    delete config.nodes.initial.pre_actions;
    config.nodes.initial.functions = [config.nodes.initial.functions![0]];
    config.nodes.extra = { task_messages: [{ role: "developer", content: "New." }] };
    applyConfigToDocument(parsed.document, config);
    const text = stringifyFlowDocument(parsed.document);

    expect(text).not.toContain("choose_sushi:");
    expect(text).not.toContain("pre_actions");
    expect(Object.keys(parse(text).nodes)).toEqual([
      "initial",
      "choose_pizza",
      "confirm",
      "end",
      "extra",
    ]);
    expect(parse(text)).toEqual(config);
  });

  it("keeps the order of existing keys and the styles of existing scalars", () => {
    const parsed = parseFlowYaml(foodOrderingText);
    applyConfigToDocument(parsed.document, structuredClone(parsed.config!));
    const text = stringifyFlowDocument(parsed.document);
    expect(Object.keys(parse(text).nodes)).toEqual(Object.keys(parsed.config!.nodes));
    expect(Object.keys(parse(text))).toEqual(["initial_node", "nodes", "global_functions"]);
    // Folded and literal blocks stay folded and literal; only their wrapping is recomputed.
    expect(text.match(/: >\n/g)?.length).toBe(foodOrderingText.match(/: >\n/g)?.length);
    expect(text.match(/: \|\n/g)?.length).toBe(foodOrderingText.match(/: \|\n/g)?.length);
  });
});

describe("createFlowDocument", () => {
  it("writes long and multi-line strings in block style", () => {
    const config = minimal();
    config.nodes.start.role_message =
      "You are an order-taking assistant. Keep replies short and avoid special characters and emojis.";
    config.nodes.start.task_messages[0].content = "Line one.\nLine two.\n";
    const text = stringifyFlowDocument(createFlowDocument(config));
    expect(text).toContain("role_message: >-\n");
    expect(text).toContain("content: |\n");
    expect(parse(text)).toEqual(config);
  });

  it("writes keys in config order", () => {
    const config = { ...minimal(), global_functions: [{ name: "help" }] };
    const text = stringifyFlowDocument(createFlowDocument(config));
    expect(text.indexOf("initial_node")).toBeLessThan(text.indexOf("nodes:"));
    expect(text.indexOf("nodes:")).toBeLessThan(text.indexOf("global_functions"));
  });
});

describe("serializeFlow", () => {
  it("round-trips Pipecat's example through the canvas with its comments", () => {
    const parsed = parseFlowYaml(foodOrderingText);
    const canvas = configToCanvas(parsed.config!);
    const { text, issues } = serializeFlow(canvas.nodes, {
      document: parsed.document,
      globalFunctions: parsed.config!.global_functions ?? [],
    });
    expect(issues).toEqual([]);
    expect(text.startsWith("# The food-ordering flow as data.")).toBe(true);
    expect(parse(text)).toEqual(parsed.config);
  });

  it("creates a document for a new flow and reports reference errors", () => {
    const canvas = configToCanvas(minimal());
    const nodes = canvas.nodes.filter((n) => n.id !== "end");
    const { text, issues, document } = serializeFlow(nodes, {
      document: null,
      globalFunctions: [],
    });
    expect(document).toBeDefined();
    expect(parse(text).initial_node).toBe("start");
    expect(issues.map((e) => e.message)).toEqual([
      "node 'start' function 'finish' transitions to unknown node 'end'",
    ]);
  });
});

describe("flowNameFromFileName", () => {
  it("strips the extension and falls back to a default", () => {
    expect(flowNameFromFileName("food_ordering.yaml")).toBe("food_ordering");
    expect(flowNameFromFileName("flow.YML")).toBe("flow");
    expect(flowNameFromFileName("flow.json")).toBe("flow");
    expect(flowNameFromFileName(".yaml")).toBe("untitled");
  });
});

describe("parseFlowYaml problems", () => {
  const lines = (text: string) =>
    parseFlowYaml(text).problems.map((p) => [p.severity, p.startLine]);

  it("locates YAML syntax errors", () => {
    const problems = parseFlowYaml("initial_node: a\nnodes:\n  a: [\n").problems;
    expect(problems[0].severity).toBe("error");
    expect(problems[0].startLine).toBeGreaterThanOrEqual(3);
  });

  it("points an unknown key at the key and a missing key at its object", () => {
    const text = [
      "initial_node: a",
      "nodes:",
      "  a:",
      "    task_messages: []",
      "    position: 1",
    ].join("\n");
    const [unknown] = parseFlowYaml(text).problems;
    expect(unknown).toMatchObject({
      severity: "error",
      message: "nodes.a.position: unknown key",
      startLine: 5,
    });

    const missing = ["initial_node: a", "nodes:", "  a:", "    functions: []"].join("\n");
    expect(parseFlowYaml(missing).problems[0]).toMatchObject({
      message: "nodes.a.task_messages: field required",
      startLine: 3,
      endLine: 3,
    });
  });

  it("points reference problems at the offending value", () => {
    const text = [
      "initial_node: nowhere",
      "nodes:",
      "  a:",
      "    task_messages: []",
      "    functions:",
      "      - name: go",
      "        transition_to: gone",
    ].join("\n");
    // Reference problems are errors, as Pipecat reports them
    expect(lines(text)).toEqual([
      ["error", 1],
      ["error", 7],
    ]);
    expect(parseFlowYaml(text).problems[1].startColumn).toBe(24);
  });

  it("has no problems for Pipecat's example", () => {
    expect(parseFlowYaml(foodOrderingText).problems).toEqual([]);
  });
});
