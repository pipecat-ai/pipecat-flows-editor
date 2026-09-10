/**
 * Edits to a branch table's cases. Cases are a map from result value to
 * node name, and its key order is the order the rows show in, except that
 * JavaScript enumerates integer-like keys first, so `3` sorts before `true`
 * however it was written. Keys are kept in the canonical form Pipecat
 * matches on, so `True` becomes `true`.
 */

import { caseKey } from "@/lib/schema/flowConfig";

export type BranchCases = Record<string, string>;

/** A placeholder value for a new case: `value_1`, `value_2`, ... */
export function nextCaseValue(cases: BranchCases): string {
  let n = Object.keys(cases).length + 1;
  while (`value_${n}` in cases) n += 1;
  return `value_${n}`;
}

export function addCase(cases: BranchCases, target: string, value?: string): BranchCases {
  return { ...cases, [value ?? nextCaseValue(cases)]: target };
}

/** Renames a case in place, keeping its position. Returns null when the new value is empty or taken. */
export function renameCase(
  cases: BranchCases,
  oldValue: string,
  requested: string
): BranchCases | null {
  const newValue = requested === "" ? "" : caseKey(requested);
  if (newValue === oldValue) return cases;
  if (newValue === "" || newValue in cases) return null;
  return Object.fromEntries(
    Object.entries(cases).map(([value, target]) => [value === oldValue ? newValue : value, target])
  );
}

export function setCaseTarget(cases: BranchCases, value: string, target: string): BranchCases {
  return Object.fromEntries(Object.entries(cases).map(([v, t]) => [v, v === value ? target : t]));
}

export function removeCase(cases: BranchCases, value: string): BranchCases {
  return Object.fromEntries(Object.entries(cases).filter(([v]) => v !== value));
}
