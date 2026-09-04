// Generates lib/schema/flowConfig.generated.ts from the vendored Pipecat schema.
//
// Run with `npm run gen:types` after updating lib/schema/flow_config.schema.json.
// The schema's own titles are `FlowConfig`, `Node`, `Function`, `Message`,
// `Action`, and `Branch`; the nested ones are prefixed here so the exported
// type names do not shadow the global `Node` and `Function` types.

import { compile } from "json-schema-to-typescript";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const schemaPath = resolve(root, "lib/schema/flow_config.schema.json");
const outputPath = resolve(root, "lib/schema/flowConfig.generated.ts");

const schema = JSON.parse(await readFile(schemaPath, "utf8"));

for (const [key, def] of Object.entries(schema.$defs ?? {})) {
  def.title = `FlowConfig${def.title ?? key}`;
}

// Pydantic titles every property ("Initial Node", "Type", ...). Left in place,
// each one becomes a top-level type alias, so drop them and keep only the
// model titles above.
for (const model of [schema, ...Object.values(schema.$defs ?? {})]) {
  for (const property of Object.values(model.properties ?? {})) {
    delete property.title;
  }
}

const banner = [
  "// Generated from lib/schema/flow_config.schema.json by",
  "// scripts/generate-flow-config-types.mjs. Do not edit by hand;",
  "// run `npm run gen:types` instead.",
  "",
].join("\n");

const types = await compile(schema, "FlowConfig", {
  bannerComment: banner,
  additionalProperties: false,
  style: { printWidth: 100, semi: true, singleQuote: false, trailingComma: "es5" },
});

await writeFile(outputPath, types);
