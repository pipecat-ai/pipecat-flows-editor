#!/usr/bin/env node
/* eslint-disable no-console -- a command-line tool reports on stdout */
/*
 * Compares the vendored FlowConfig schema with Pipecat's copy at a git ref.
 * This is how the editor finds out that the contract moved on Pipecat's main.
 *
 *   npm run check:schema            # the pinned commit; should match
 *   npm run check:schema -- main    # Pipecat's current main
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PINNED = "e91cfc249";
const ref = process.argv[2] ?? PINNED;
const url = `https://raw.githubusercontent.com/pipecat-ai/pipecat/${ref}/src/pipecat/flows/flow_config.schema.json`;

const here = dirname(fileURLToPath(import.meta.url));
const local = JSON.parse(
  readFileSync(resolve(here, "../lib/schema/flow_config.schema.json"), "utf8")
);

const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
if (!response.ok) {
  console.error(`Could not fetch the schema at ${ref}: ${response.status} ${response.statusText}`);
  process.exit(2);
}
const upstream = await response.json();

const canonical = (value) => JSON.stringify(value, Object.keys(value).sort());
const same = JSON.stringify(sortKeys(local)) === JSON.stringify(sortKeys(upstream));

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortKeys(value[key])])
    );
  }
  return value;
}

if (same) {
  console.log(`The vendored schema matches pipecat at ${ref}.`);
  process.exit(0);
}

console.log(`The vendored schema differs from pipecat at ${ref}.`);
const defs = new Set([...Object.keys(local.$defs ?? {}), ...Object.keys(upstream.$defs ?? {})]);
for (const name of [...defs].sort()) {
  const a = local.$defs?.[name];
  const b = upstream.$defs?.[name];
  if (!a) console.log(`  + $defs.${name} is new upstream`);
  else if (!b) console.log(`  - $defs.${name} is gone upstream`);
  else if (canonical(sortKeys(a)) !== canonical(sortKeys(b)))
    console.log(`  ~ $defs.${name} changed`);
}
for (const key of new Set([...Object.keys(local), ...Object.keys(upstream)])) {
  if (key === "$defs") continue;
  if (JSON.stringify(sortKeys(local[key])) !== JSON.stringify(sortKeys(upstream[key]))) {
    console.log(`  ~ ${key} changed`);
  }
}
console.log("Re-vendor with the steps under Contributing in the README.");
process.exit(1);
