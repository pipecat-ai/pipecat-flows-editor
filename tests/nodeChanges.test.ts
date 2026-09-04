import { describe, expect, it } from "vitest";

import { configToCanvas } from "@/lib/convert/configToCanvas";
import type { FlowConfig } from "@/lib/schema/flowConfig";
import { filterNodeChanges } from "@/lib/utils/nodeChanges";

const config: FlowConfig = {
  initial_node: "start",
  nodes: {
    start: {
      task_messages: [],
      functions: [{ name: "check", transition_to: { field: "s", cases: { ok: "next" } } }],
    },
    next: { task_messages: [] },
  },
};

describe("filterNodeChanges", () => {
  it("drops removals of the initial node and branch nodes, keeps the rest", () => {
    const { nodes } = configToCanvas(config);
    const branch = nodes.find((n) => n.type === "decision")!;
    const changes = filterNodeChanges(
      [
        { type: "remove", id: "start" },
        { type: "remove", id: branch.id },
        { type: "remove", id: "next" },
        { type: "select", id: "start", selected: true },
      ],
      nodes
    );
    expect(changes).toEqual([
      { type: "remove", id: "next" },
      { type: "select", id: "start", selected: true },
    ]);
  });
});
