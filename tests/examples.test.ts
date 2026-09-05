import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { parseFlowYaml } from "@/lib/document/flowDocument";
import { referencedTools } from "@/lib/document/flowIntrospection";
import { EXAMPLES } from "@/lib/examples";

const dir = resolve(__dirname, "../public/examples");

describe("shipped examples", () => {
  it("lists every file in public/examples exactly once", () => {
    const files = readdirSync(dir)
      .filter((f) => f.endsWith(".yaml"))
      .sort();
    const listed = EXAMPLES.map((e) => e.path.replace("/examples/", "")).sort();
    expect(listed).toEqual(files);
    expect(new Set(EXAMPLES.map((e) => e.id)).size).toBe(EXAMPLES.length);
  });

  for (const example of EXAMPLES) {
    it(`${example.id} is a valid config with no errors or warnings`, () => {
      const parsed = parseFlowYaml(
        readFileSync(resolve(dir, example.path.replace("/examples/", "")), "utf8")
      );
      expect(parsed.yamlErrors).toEqual([]);
      expect(parsed.issues).toEqual([]);
      expect(parsed.config).not.toBeNull();
      // Every example is a starting point for a tools module
      expect(referencedTools(parsed.config!).length).toBeGreaterThan(0);
    });
  }
});
