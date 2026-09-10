// Generated from lib/schema/flow_config.schema.json by
// scripts/generate-flow-config-types.mjs. Do not edit by hand;
// run `npm run gen:types` instead.

/**
 * A conversation flow described as data.
 *
 * Load one with :meth:`from_file` for a YAML or JSON file, :meth:`from_yaml`
 * for YAML text, :meth:`from_json` for JSON text, or Pydantic's
 * ``model_validate`` for a dict that is already parsed.
 *
 * Prompt text may refer to the manager's state with ``{{ key }}``
 * placeholders: a node's ``role_message``, the ``content`` of its
 * ``task_messages``, and the ``text`` of a ``tts_say`` action.
 * :class:`~pipecat.flows.FlowManager` fills them from ``flow_manager.state``
 * each time it enters the node, so a value stored by a handler earlier in the
 * conversation can appear in a later prompt. ``{{ order.size }}`` walks into
 * a stored mapping, and values are rendered with ``str()``. A key that is not
 * in state raises :class:`~pipecat.flows.FlowError` when the node is entered.
 * To show the LLM a literal ``{{ key }}``, escape it as ``\{{ key }}``.
 *
 * Parameters:
 *     initial_node: Name of the node the flow starts in.
 *     nodes: The flow's nodes, keyed by name.
 *     global_functions: Tools offered at every node.
 */
export interface FlowConfig {
  initial_node: string;
  nodes: {
    [k: string]: FlowConfigNode;
  };
  global_functions?: FlowConfigFunction[];
}
/**
 * One node of the flow.
 *
 * Parameters:
 *     task_messages: What the LLM should do at this node.
 *     role_message: The bot's role or personality, sent as the LLM's
 *         system instruction on entering this node. It persists across
 *         transitions until another node sets its own. May contain
 *         ``{{ key }}`` placeholders; see :class:`FlowConfig`.
 *     functions: Tools offered at this node, in addition to the
 *         config's ``global_functions``.
 *     pre_actions: Actions run before the LLM responds at this node.
 *     post_actions: Actions run after the LLM responds at this node.
 *     context_strategy: How the LLM context is updated on entering this
 *         node. Defaults to the ``FlowManager``'s strategy.
 *     respond_immediately: Whether the LLM responds as soon as the node
 *         is entered. Defaults to True.
 */
export interface FlowConfigNode {
  task_messages: FlowConfigMessage[];
  role_message?: string | null;
  functions?: FlowConfigFunction[];
  pre_actions?: FlowConfigAction[];
  post_actions?: FlowConfigAction[];
  context_strategy?: ("append" | "reset") | null;
  respond_immediately?: boolean;
}
/**
 * One message in a node's ``task_messages``.
 *
 * Parameters:
 *     role: Message role, e.g. ``developer`` or ``system``.
 *     content: Message text. May contain ``{{ key }}`` placeholders;
 *         see :class:`FlowConfig`.
 */
export interface FlowConfigMessage {
  role: string;
  content: string;
}
/**
 * A tool offered at a node.
 *
 * Ordinarily the entry names a Flows direct function in the handlers a
 * :class:`~pipecat.flows.Flow` is constructed with, and the tool's
 * description and parameters come from that function. A
 * ``transition_only`` entry is defined entirely here instead: it takes
 * no parameters, runs no code, and moves the conversation to
 * ``transition_to`` when the LLM calls it.
 *
 * Parameters:
 *     name: The tool's name, as the LLM sees it. For an ordinary
 *         entry, also the name of the direct function in the handlers.
 *     transition_only: Whether the tool is defined here rather than in
 *         code. Requires ``description`` and a ``transition_to`` that
 *         names a node.
 *     description: What the tool is for, for the LLM. Only a
 *         ``transition_only`` entry has one; a direct function
 *         describes itself in its docstring.
 *     transition_to: Node to transition to after the tool completes,
 *         or a :class:`FlowConfig.Branch`. Omitted for tools that stay
 *         on the current node.
 */
export interface FlowConfigFunction {
  name: string;
  transition_only?: boolean;
  description?: string | null;
  transition_to?: string | FlowConfigBranch | null;
}
/**
 * A transition chosen by a field of the tool's result.
 *
 * Parameters:
 *     field: Key of the tool's result whose value selects the case.
 *     cases: Result value to node name. Keys may be written as strings,
 *         booleans, or numbers; they match the result value by its
 *         canonical string (see :func:`case_key`), so ``true:`` matches a
 *         result of ``True``.
 *     default: Node to transition to when the value matches no case.
 *         When omitted, an unmatched value stays on the current node.
 */
export interface FlowConfigBranch {
  field: string;
  cases: {
    [k: string]: string;
  };
  default?: string | null;
}
/**
 * A pre- or post-action on a node.
 *
 * The built-in ``tts_say`` and ``end_conversation`` types take no
 * handler. The built-in ``function`` type requires one: the handler runs
 * inline in the pipeline, queued behind the bot's turn. A custom type
 * may name a handler too, which then runs immediately when the node's
 * actions execute; a custom type without one must be registered in code
 * with ``FlowManager.register_action``. Any additional keys pass through
 * to the handler. The ``text`` of a ``tts_say`` action may contain
 * ``{{ key }}`` placeholders; see :class:`FlowConfig`.
 *
 * Parameters:
 *     type: Action type identifier.
 *     handler: Name of the handler in the handlers a
 *         :class:`~pipecat.flows.Flow` is constructed with. Required
 *         for ``function``, optional for custom types, not allowed on
 *         ``tts_say`` or ``end_conversation``.
 */
export interface FlowConfigAction {
  type: string;
  handler?: string | null;
  [k: string]: unknown;
}
