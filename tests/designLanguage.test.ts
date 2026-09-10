import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

/*
 * The design rule, held by a test so it does not drift: what you operate is
 * square and hairline, what depicts the flow stays soft, and form controls
 * and floating menus keep the radius token as pipecat.ai's own do. A radius
 * anywhere else is a slip.
 */
const KEEP_RADIUS = new Set([
  // Form controls, rounded as the site's inputs are
  "components/ui/input.tsx",
  "components/ui/textarea.tsx",
  "components/ui/select.tsx",
  "components/ui/checkbox.tsx",
  // Floating menus and tips, rounded as the site's menus are
  "components/ui/dropdown-menu.tsx",
  "components/ui/tooltip.tsx",
  "components/nodes/NodeContextMenu.tsx",
  // The canvas: node cards and what sits on them
  "components/nodes/BaseNode.tsx",
  "components/nodes/InlineText.tsx",
  "components/nodes/NodeAddToolbar.tsx",
]);

const ROOT = resolve(__dirname, "..");
const RADIUS = /\brounded(?!-none\b)(?:-[a-z0-9[\]/.]+)?\b/g;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return name.endsWith(".tsx") ? [path] : [];
  });
}

describe("design language", () => {
  it("keeps the radius to form controls, menus, and the canvas", () => {
    const slips: string[] = [];
    for (const dir of ["app", "components"]) {
      for (const file of sourceFiles(join(ROOT, dir))) {
        const rel = relative(ROOT, file);
        if (KEEP_RADIUS.has(rel)) continue;
        readFileSync(file, "utf8")
          .split("\n")
          .forEach((line, i) => {
            const found = line.match(RADIUS);
            if (found) slips.push(`${rel}:${i + 1}: ${found.join(" ")}`);
          });
      }
    }
    expect(slips).toEqual([]);
  });
});
