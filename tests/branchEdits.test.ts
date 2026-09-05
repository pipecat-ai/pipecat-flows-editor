import { describe, expect, it } from "vitest";

import { type ConfigCanvasNode, configToCanvas } from "@/lib/convert/configToCanvas";
import type { FlowConfig } from "@/lib/schema/flowConfig";
import { addCase, removeCase, renameCase, setCaseTarget } from "@/lib/utils/branchEdits";
import { removeBranchCase } from "@/lib/utils/nodeUpdates";

describe("branch case edits", () => {
  const cases = { ok: "confirm", bad: "retry" };

  it("adds a case under a placeholder value that is not taken", () => {
    expect(addCase(cases, "end")).toEqual({ ...cases, value_3: "end" });
    expect(addCase({ value_2: "x" }, "end")).toEqual({ value_2: "x", value_3: "end" });
    expect(addCase(cases, "end", "maybe")).toEqual({ ...cases, maybe: "end" });
  });

  it("renames a case in place and rejects empty or duplicate values", () => {
    expect(Object.entries(renameCase(cases, "ok", "available")!)).toEqual([
      ["available", "confirm"],
      ["bad", "retry"],
    ]);
    expect(renameCase(cases, "ok", "ok")).toBe(cases);
    expect(renameCase(cases, "ok", "")).toBeNull();
    expect(renameCase(cases, "ok", "bad")).toBeNull();
  });

  it("changes a case's target and removes a case", () => {
    expect(setCaseTarget(cases, "bad", "end")).toEqual({ ok: "confirm", bad: "end" });
    expect(removeCase(cases, "ok")).toEqual({ bad: "retry" });
  });
});

describe("removeBranchCase", () => {
  const config: FlowConfig = {
    initial_node: "a",
    nodes: {
      a: {
        task_messages: [],
        functions: [
          {
            name: "check",
            transition_to: { field: "s", cases: { ok: "a", bad: "a" }, default: "a" },
          },
        ],
      },
    },
  };
  const fn = (nodes: ReturnType<typeof configToCanvas>["nodes"]) =>
    (nodes.find((n) => n.id === "a") as ConfigCanvasNode).data.functions![0];

  it("removes the case at an index or the default at -1", () => {
    const { nodes } = configToCanvas(config);
    expect(fn(removeBranchCase(nodes, "a", 0, 1)).transition_to).toEqual({
      field: "s",
      cases: { ok: "a" },
      default: "a",
    });
    expect(fn(removeBranchCase(nodes, "a", 0, -1)).transition_to).toEqual({
      field: "s",
      cases: { ok: "a", bad: "a" },
    });
    expect(fn(removeBranchCase(nodes, "a", 0, 5))).toEqual(config.nodes.a.functions![0]);
  });
});
