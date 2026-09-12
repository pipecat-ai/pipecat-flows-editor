/**
 * What a config asks of the code around it: the tools and action handlers
 * the handlers must define, and the state keys the prompts read. This list
 * is the handoff to code; the editor generates no Python.
 */

import {
  actionHandler,
  type FlowConfig,
  type FlowConfigFunction,
  type FlowConfigNode,
  isRegisteredInCode,
} from "@/lib/schema/flowConfig";

/** A name the config uses, and the nodes that use it (`global` for global functions). */
export interface NameReference {
  name: string;
  usedBy: string[];
}

export const GLOBAL_SCOPE = "global";

/**
 * Pipecat's placeholder syntax, `_PLACEHOLDER` in `pipecat/flows/manager.py`:
 * `{{ key }}` or a dotted path such as `{{ order.size }}`, with a leading
 * backslash marking a literal that is not a placeholder.
 */
export const PLACEHOLDER_PATTERN =
  /(\\?)\{\{\s*([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)\s*\}\}/g;

class References {
  private byName = new Map<string, string[]>();

  add(name: string, scope: string) {
    const scopes = this.byName.get(name) ?? [];
    if (!scopes.includes(scope)) scopes.push(scope);
    this.byName.set(name, scopes);
  }

  sorted(): NameReference[] {
    return [...this.byName.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, usedBy]) => ({ name, usedBy }));
  }
}

/**
 * Every direct function the config references, by node. A `transition_only`
 * entry is defined in the config alone and needs no Python, so it is left out.
 */
export function referencedTools(config: FlowConfig): NameReference[] {
  const refs = new References();
  const isTool = (fn: FlowConfigFunction) => Boolean(fn.name) && !fn.transition_only;
  for (const [nodeName, node] of Object.entries(config.nodes)) {
    for (const fn of node.functions ?? []) if (isTool(fn)) refs.add(fn.name, nodeName);
  }
  for (const fn of config.global_functions ?? []) if (isTool(fn)) refs.add(fn.name, GLOBAL_SCOPE);
  return refs.sorted();
}

/** Every action handler the config names, on `function` actions and on custom types, by node. */
export function actionHandlers(config: FlowConfig): NameReference[] {
  const refs = new References();
  for (const [nodeName, node] of Object.entries(config.nodes)) {
    for (const action of [...(node.pre_actions ?? []), ...(node.post_actions ?? [])]) {
      const handler = actionHandler(action);
      if (handler !== null) refs.add(handler, nodeName);
    }
  }
  return refs.sorted();
}

/** Every custom action type the config uses without naming a handler; its handler is registered in code. */
export function registeredActionTypes(config: FlowConfig): NameReference[] {
  const refs = new References();
  for (const [nodeName, node] of Object.entries(config.nodes)) {
    for (const action of [...(node.pre_actions ?? []), ...(node.post_actions ?? [])]) {
      if (isRegisteredInCode(action)) refs.add(action.type, nodeName);
    }
  }
  return refs.sorted();
}

/**
 * Every `{{ key }}` placeholder in the texts the FlowManager renders from its
 * state on entering a node: role messages, task messages, and `tts_say` text.
 * Each distinct path once; escaped `\{{ key }}` literals are not placeholders.
 */
export function statePlaceholders(config: FlowConfig): NameReference[] {
  const refs = new References();
  for (const [nodeName, node] of Object.entries(config.nodes)) {
    for (const text of renderedTexts(node)) {
      for (const match of text.matchAll(PLACEHOLDER_PATTERN)) {
        if (!match[1]) refs.add(match[2], nodeName);
      }
    }
  }
  return refs.sorted();
}

function renderedTexts(node: FlowConfigNode): string[] {
  const texts: string[] = [];
  if (node.role_message) texts.push(node.role_message);
  for (const message of node.task_messages ?? []) texts.push(message.content);
  for (const action of [...(node.pre_actions ?? []), ...(node.post_actions ?? [])]) {
    if (typeof action.text === "string") texts.push(action.text);
  }
  return texts;
}
