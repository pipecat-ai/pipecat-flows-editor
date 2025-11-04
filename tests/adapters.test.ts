import { describe, it, expect } from "vitest";
import { reactFlowToFlowJson, flowJsonToReactFlow } from "@/lib/convert/flowAdapters";

describe("adapters", () => {
  it("converts React Flow to Flow JSON and back", () => {
    const nodes = [
      { id: "a", type: "start", position: { x: 0, y: 0 }, data: { label: "A" } },
      { id: "b", type: "end", position: { x: 100, y: 0 }, data: { label: "B" } },
    ] as any;
    const edges = [{ id: "e1", source: "a", target: "b" }] as any;
    const json = reactFlowToFlowJson(nodes, edges);
    expect(json.nodes.length).toBe(2);
    expect(json.edges.length).toBe(1);
    const rf = flowJsonToReactFlow(json);
    expect(rf.nodes.length).toBe(2);
    expect(rf.edges.length).toBe(1);
  });
});
