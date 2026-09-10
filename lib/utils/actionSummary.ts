/**
 * What a node's actions do, in words for the card and the inspector. Ending
 * the conversation is left out, since the card already draws that as an end
 * node.
 */

import {
  BUILT_IN_ACTIONS,
  type FlowConfigAction,
  type FlowConfigNode,
} from "@/lib/schema/flowConfig";

export type ActionKind = "says" | "handler" | "custom";

export interface ActionSummary {
  kind: ActionKind;
  /** One line per action of this kind, in config order. */
  lines: string[];
}

/** A line the card draws under the node's name. */
export interface ActionLine {
  kind: ActionKind | "more";
  /** The words on the card: the spoken text, or the handler or type name. */
  text: string;
  /** The full sentence, for the tooltip. */
  title: string;
}

const QUOTE_LIMIT = 60;
/** How many action lines a card shows per block before folding the rest into "+N more". */
export const CARD_ACTION_LINES = 2;

function shorten(s: string, limit = QUOTE_LIMIT): string {
  return s.length > limit ? `${s.slice(0, limit - 1)}…` : s;
}

interface Described {
  kind: ActionKind;
  text: string;
  title: string;
}

function describe(action: FlowConfigAction, when: "before" | "after"): Described | null {
  if (action.type === "end_conversation") return null;
  if (action.type === "tts_say") {
    const text = typeof action.text === "string" ? action.text.trim() : "";
    return {
      kind: "says",
      text: text ? `“${text}”` : "says a line",
      title: text ? `Says "${shorten(text)}" ${when} the node` : `Says a line ${when} the node`,
    };
  }
  if (action.type === "function") {
    const name = action.handler || "an unnamed handler";
    return { kind: "handler", text: `runs ${name}`, title: `Runs ${name} ${when} the node` };
  }
  if (!BUILT_IN_ACTIONS.has(action.type)) {
    const type = action.type || "an unnamed type";
    return action.handler
      ? {
          kind: "custom",
          text: `runs ${action.handler}`,
          title: `Runs ${action.handler} for the ${type} action ${when} the node`,
        }
      : {
          kind: "custom",
          text: type,
          title: `Custom action ${type} ${when} the node, registered in code`,
        };
  }
  return null;
}

function describeAll(node: Pick<FlowConfigNode, "pre_actions" | "post_actions">): Described[] {
  const out: Described[] = [];
  for (const action of node.pre_actions ?? []) {
    const d = describe(action, "before");
    if (d) out.push(d);
  }
  for (const action of node.post_actions ?? []) {
    const d = describe(action, "after");
    if (d) out.push(d);
  }
  return out;
}

/** The kinds of action a node carries, in the order says, handler, custom. */
export function summarizeActions(
  node: Pick<FlowConfigNode, "pre_actions" | "post_actions">
): ActionSummary[] {
  const byKind = new Map<ActionKind, string[]>();
  for (const { kind, title } of describeAll(node)) {
    byKind.set(kind, [...(byKind.get(kind) ?? []), title]);
  }
  const order: ActionKind[] = ["says", "handler", "custom"];
  return order
    .filter((kind) => byKind.has(kind))
    .map((kind) => ({ kind, lines: byKind.get(kind)! }));
}

function fold(all: Described[]): ActionLine[] {
  if (all.length <= CARD_ACTION_LINES) return all;
  const shown = all.slice(0, CARD_ACTION_LINES - 1);
  const rest = all.slice(shown.length);
  return [
    ...shown,
    { kind: "more", text: `+${rest.length} more`, title: rest.map((d) => d.title).join("\n") },
  ];
}

/**
 * The lines a card draws: pre-actions above the functions, post-actions
 * below, so the card reads in the order things happen. Past the limit, a
 * block folds the rest into one "+N more" line, so the counts returned are
 * the counts drawn and the layout can rely on them.
 */
export function cardActionLines(node: Pick<FlowConfigNode, "pre_actions" | "post_actions">): {
  before: ActionLine[];
  after: ActionLine[];
} {
  const describeList = (actions: FlowConfigAction[] | undefined, when: "before" | "after") =>
    (actions ?? []).flatMap((action) => {
      const d = describe(action, when);
      return d ? [d] : [];
    });
  return {
    before: fold(describeList(node.pre_actions, "before")),
    after: fold(describeList(node.post_actions, "after")),
  };
}
