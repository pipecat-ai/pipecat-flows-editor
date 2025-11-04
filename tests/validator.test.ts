import { describe, it, expect } from "vitest";
import { validateFlowJson, customGraphChecks } from "@/lib/validation/validator";
import minimal from "@/lib/examples/minimal.json";

describe("validator", () => {
  it("validates minimal example", () => {
    const r = validateFlowJson(minimal);
    expect(r.valid).toBe(true);
    const custom = customGraphChecks(minimal as any);
    expect(custom.length).toBe(0);
  });

  it("detects duplicate node id", () => {
    const dup = JSON.parse(JSON.stringify(minimal));
    dup.nodes.push({ ...dup.nodes[0] });
    validateFlowJson(dup);
    // schema may still be valid; custom should catch duplicate id
    const custom = customGraphChecks(dup as any);
    expect(custom.some((e) => String(e.message).includes("Duplicate node id"))).toBe(true);
  });
});
