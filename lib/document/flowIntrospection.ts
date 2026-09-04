/**
 * What a config asks of the code around it: the tools and action handlers
 * the tools module must define, and the variables the `Flow` must be given.
 * This list is the handoff to code; the editor generates no Python.
 */

import { type FlowConfig, type FlowConfigNode } from "@/lib/schema/flowConfig";

/** A name the config uses, and the nodes that use it (`global` for global functions). */
export interface NameReference {
  name: string;
  usedBy: string[];
}

export const GLOBAL_SCOPE = "global";

/** Pipecat's placeholder syntax, from `pipecat/flows/flow.py`. */
export const VARIABLE_PATTERN = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g;

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

/** Every direct function the config references, by node. */
export function referencedTools(config: FlowConfig): NameReference[] {
  const refs = new References();
  for (const [nodeName, node] of Object.entries(config.nodes)) {
    for (const fn of node.functions ?? []) if (fn.name) refs.add(fn.name, nodeName);
  }
  for (const fn of config.global_functions ?? []) if (fn.name) refs.add(fn.name, GLOBAL_SCOPE);
  return refs.sorted();
}

/** Every `function` action handler the config references, by node. */
export function actionHandlers(config: FlowConfig): NameReference[] {
  const refs = new References();
  for (const [nodeName, node] of Object.entries(config.nodes)) {
    for (const action of [...(node.pre_actions ?? []), ...(node.post_actions ?? [])]) {
      if (action.type === "function" && action.handler) refs.add(action.handler, nodeName);
    }
  }
  return refs.sorted();
}

/** Every `{{ variable }}` in the texts Pipecat renders: role messages, task messages, and action text. */
export function templateVariables(config: FlowConfig): NameReference[] {
  const refs = new References();
  for (const [nodeName, node] of Object.entries(config.nodes)) {
    for (const text of renderedTexts(node)) {
      for (const match of text.matchAll(VARIABLE_PATTERN)) refs.add(match[1], nodeName);
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
