import { beforeEach, describe, expect, it } from "vitest";

import { loadCurrentFlow, saveCurrentFlow } from "@/lib/storage/localStore";

describe("storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("saves and loads the current flow", () => {
    saveCurrentFlow({ flowName: "food_ordering", yaml: "initial_node: a\n" });
    expect(loadCurrentFlow()).toEqual({ flowName: "food_ordering", yaml: "initial_node: a\n" });
  });

  it("returns null when nothing or something malformed is stored", () => {
    expect(loadCurrentFlow()).toBeNull();
    localStorage.setItem("pipecat-flows-editor/flow", '{"nodes": []}');
    expect(loadCurrentFlow()).toBeNull();
  });
});
