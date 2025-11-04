import { describe, it, expect, beforeEach } from "vitest";
import { saveCurrent, loadCurrent } from "@/lib/storage/localStore";

describe("storage", () => {
  beforeEach(() => {
    // reset localStorage
    localStorage.clear();
  });

  it("saves and loads current", () => {
    const payload = { nodes: [{ id: "n1" }], edges: [] } as any;
    saveCurrent(payload);
    const loaded = loadCurrent<typeof payload>();
    expect(loaded?.nodes?.[0]?.id).toBe("n1");
  });
});
