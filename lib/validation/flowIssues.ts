/**
 * The shape of every finding the editor produces, matching `FlowIssue` in
 * `pipecat/flows/validation.py` so a report from either side reads the same.
 * The editor itself produces `schema` errors and the three graph warnings;
 * the tool and variable codes are here so a backend calling Pipecat's
 * `validate_flow` needs no mapping.
 */

export type FlowIssueLevel = "error" | "warning";

export type FlowIssueCode =
  | "schema"
  | "missing_tool"
  | "invalid_tool"
  | "missing_handler"
  | "missing_variable"
  | "unreachable_node"
  | "dead_end"
  | "branch_single_target";

export interface FlowIssue {
  /** `error` for a config the runtime would reject; `warning` for one that probably does not do what its author meant. */
  level: FlowIssueLevel;
  /** Stable identifier for the kind of problem, for tooling. */
  code: FlowIssueCode;
  /** Names the node, function, or field involved. */
  message: string;
  /** The node the issue is about, when there is one. */
  node?: string;
  /** The function entry the issue is about, when there is one. */
  function?: string;
}

/** An issue with where it sits in the document, so the YAML pane can mark it. */
export interface LocatedIssue extends FlowIssue {
  instancePath?: string;
}

/** The result of `validateFlow`, matching `FlowReport.to_dict()` in Pipecat. */
export interface FlowReport {
  /** Whether the config has no errors. Warnings do not affect this. */
  ok: boolean;
  /** Every error and warning found, in the order found. */
  issues: LocatedIssue[];
  /** Every tool the config references, including action handlers, sorted. */
  tools: string[];
  /** Every `{{ variable }}` the config uses, sorted. */
  variables: string[];
}

export function issueErrors<T extends FlowIssue>(issues: T[]): T[] {
  return issues.filter((issue) => issue.level === "error");
}

export function issueWarnings<T extends FlowIssue>(issues: T[]): T[] {
  return issues.filter((issue) => issue.level === "warning");
}

/** A short count for a toast: "2 errors and 1 warning". */
export function summarizeIssues(issues: FlowIssue[]): string {
  const errors = issueErrors(issues).length;
  const warnings = issueWarnings(issues).length;
  const parts: string[] = [];
  if (errors > 0) parts.push(`${errors} error${errors === 1 ? "" : "s"}`);
  if (warnings > 0) parts.push(`${warnings} warning${warnings === 1 ? "" : "s"}`);
  return parts.join(" and ");
}
