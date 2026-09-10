import { describe, expect, it } from "vitest";

import {
  caseKey,
  type FlowConfig,
  type FlowConfigBranch,
  normalizeCaseKeys,
} from "@/lib/schema/flowConfig";

describe("normalizeCaseKeys", () => {
  it("folds keys to their canonical form, the last of two that meet winning", () => {
    const config: FlowConfig = {
      initial_node: "a",
      nodes: {
        a: {
          task_messages: [],
          functions: [
            {
              name: "f",
              transition_to: {
                field: "ok",
                cases: { True: "first", true: "second", TRUE: "third", "3": "b", other: "b" },
              },
            },
          ],
        },
        b: { task_messages: [] },
      },
      global_functions: [
        { name: "g", transition_to: { field: "ok", cases: { False: "a", false: "b" } } },
      ],
    };
    const normalized = normalizeCaseKeys(config);
    expect(normalized.nodes.a.functions?.[0].transition_to).toEqual({
      field: "ok",
      cases: { "3": "b", true: "third", other: "b" },
    });
    expect(normalized.global_functions?.[0].transition_to).toEqual({
      field: "ok",
      cases: { false: "b" },
    });
    // The input is left alone
    const original = config.nodes.a.functions![0].transition_to as FlowConfigBranch;
    expect(Object.keys(original.cases)).toHaveLength(5);
  });

  it("caseKey folds booleans and any-case true/false and leaves other strings alone", () => {
    expect(caseKey(true)).toBe("true");
    expect(caseKey("FALSE")).toBe("false");
    expect(caseKey("Yes")).toBe("Yes");
    expect(caseKey(3)).toBe("3");
  });
});
