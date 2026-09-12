# Pipecat Integration Guide

This document explains how a flow built in the editor runs inside a Pipecat application. It is written against Pipecat `main` as of the merge of PR #5628 (`e91cfc249`).

## The seam

Pipecat Flows splits a configured conversation along one line:

- **The YAML owns the graph.** Which nodes exist, what each one says, which tools each offers, where each tool leads, the pre and post actions, and the functions that only move the conversation. This is what the editor edits.
- **Python owns the handlers.** Every tool that does work is a direct function in a Python module: its signature and docstring define what the LLM sees, and its body does the work. Action handlers and custom action types live there too.

The YAML references tools by name and carries a description only for a transition-only function, which has nothing behind it in Python. That is why the editor has no tool schema forms: a tool's description and parameters come from the code.

## Flow lifecycle

1. **Design** – Build the flow in the editor. Use the Flow panel to see which tool names and action handlers the config refers to, and which `{{ key }}` placeholders its prompts read from state.
2. **Save** – Download `<name>.yaml`.
3. **Write the handlers** – Implement each referenced name as a direct function or action handler in a Python module.
4. **Run** – Load the config, join it to the handlers with `Flow`, and hand the result to `FlowManager`.

## The format

The same graph as Pipecat's `examples/flows/yaml/food_ordering/flow.yaml`, shortened:

```yaml
initial_node: initial

nodes:
  initial:
    role_message: >
      You are an order-taking assistant for {{ restaurant_name }}. This is a
      phone call, so keep replies short and avoid special characters.
    task_messages:
      - role: developer
        content: Greet the caller and ask whether they want pizza or sushi.
    pre_actions:
      - type: function
        handler: check_kitchen_status # an action handler in the handlers
    functions:
      - name: choose_pizza # defined here; no Python
        transition_only: true
        description: The caller wants to order pizza.
        transition_to: choose_pizza
      - name: choose_sushi
        transition_only: true
        description: The caller wants to order sushi.
        transition_to: choose_sushi

  choose_pizza:
    task_messages:
      - role: developer
        content: Take a pizza order. Call select_pizza_order once you have size and type.
    functions:
      - name: select_pizza_order # a direct function in the handlers
        transition_to: confirm

  confirm:
    task_messages:
      - role: developer
        content: Read the order back and ask whether anything should change.
    functions:
      - name: complete_order
        transition_only: true
        description: The caller confirms the order is correct.
        transition_to: end
      - name: revise_order
        transition_only: true
        description: The caller wants to make changes to their order.
        transition_to: initial

  end:
    task_messages:
      - role: developer
        content: Thank the caller and end the conversation.
    post_actions:
      - type: end_conversation

global_functions:
  - name: get_delivery_estimate # no transition_to: stays on the current node
```

| Key                                | Meaning                                                                                                                                                                           |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `initial_node`                     | Name of the node the flow starts in.                                                                                                                                              |
| `nodes.<name>.role_message`        | The bot's role, sent as the system instruction on entering the node. Persists until another node sets its own. May contain `{{ key }}` placeholders.                              |
| `nodes.<name>.task_messages`       | What the LLM should do at this node. Roles are `developer`, `user`, or `assistant`; Pipecat maps `developer` to `system` where needed. Content may contain placeholders.          |
| `nodes.<name>.functions`           | Tools offered at this node, each a `name` and an optional `transition_to`. A `transition_only` entry also carries a `description` and must name a node.                           |
| `nodes.<name>.pre_actions`         | Actions run before the LLM responds. Built-in types are `tts_say` and `end_conversation`; `function` names a `handler`; a custom type may name one too, or be registered in code. |
| `nodes.<name>.post_actions`        | Actions run after the LLM responds.                                                                                                                                               |
| `nodes.<name>.context_strategy`    | `append` or `reset`. Omitted, the `FlowManager`'s strategy applies.                                                                                                               |
| `nodes.<name>.respond_immediately` | Whether the LLM responds as soon as the node is entered. Defaults to true.                                                                                                        |
| `global_functions`                 | Tools offered at every node.                                                                                                                                                      |

### Branches

A destination is a node name or a table keyed on a field of the tool's result. The tool reports a fact it knows; the config decides where it leads.

```yaml
- name: check_availability
  transition_to:
    field: status # key of the tool's result
    cases:
      available: confirm
      unavailable: no_availability
    default: no_availability # optional; unmatched values stay on the node
```

Case keys may be written as strings, booleans, or numbers; they match the result value by its canonical string, so `true:` matches a result of `True`. A result without the named field is an error.

### Transition-only functions

A function that only moves the conversation needs no Python. Write it in the config with `transition_only: true`, a `description` the LLM reads, and the node it leads to:

```yaml
- name: revise_order
  transition_only: true
  description: The caller wants to make changes to their order.
  transition_to: initial
```

It takes no parameters and runs no code. This is the case the editor exists for: adding or rewording one is a change to the YAML, with no deploy. The three half-formed shapes are errors on both sides, in the same words: a transition-only function needs a description; it must name the node it transitions to, so it cannot branch; and a description only applies to a transition-only function, since a direct function describes itself in its docstring.

### State placeholders

`{{ key }}` in a `role_message`, a task message's `content`, or a `tts_say` action's `text` is filled by `FlowManager` from `flow_manager.state` each time the node is entered, so a value a handler stores earlier in the conversation can appear in a later prompt. `{{ order.size }}` walks into a stored mapping, and values are rendered with `str()`. A key that is not in state raises a `FlowError` when the node is entered. To show the LLM a literal `{{ key }}`, escape it as `\{{ key }}`.

The Flow panel lists every key the prompts read. Handlers store them in `flow_manager.state`, or the app sets them before `initialize()`.

The authoritative definition of the format is Pipecat's JSON Schema, generated from the `FlowConfig` model and vendored in this repo at `lib/schema/flow_config.schema.json`.

## The handlers

Tools are ordinary Flows direct functions. They return `(result, TRANSITION_IN_YAML)`: the config owns every transition, so a tool in a configured flow never returns a node, and the sentinel says so in the code. Pipecat's examples keep them in `handlers.py`; the name is yours to choose.

```python
# handlers.py
from datetime import datetime, timedelta

from pipecat.flows import TRANSITION_IN_YAML, FlowManager


async def select_pizza_order(flow_manager: FlowManager, size: str, pizza_type: str):
    """Record the pizza order details.

    Args:
        size (str): One of "small", "medium", or "large".
        pizza_type (str): One of "pepperoni", "cheese", "supreme", or "vegetarian".
    """
    price = {"small": 10.0, "medium": 15.0, "large": 20.0}[size]
    flow_manager.state["order"] = {"type": "pizza", "size": size, "price": price}
    return {"size": size, "type": pizza_type, "price": price}, TRANSITION_IN_YAML


async def get_delivery_estimate(flow_manager: FlowManager):
    """Get a delivery estimate for the current order."""
    eta = datetime.now() + timedelta(minutes=30)
    return {"time": eta.isoformat()}, TRANSITION_IN_YAML


async def check_kitchen_status(action: dict, flow_manager: FlowManager) -> None:
    """Pre-action: check the kitchen is open."""
    ...
```

When a transition depends on logic, keep the business logic flow-agnostic and write a thin tool that calls it and reports the outcome as a field for a branch table to route on. Pipecat's `restaurant_reservation` example does this: `check_availability` returns `{"status": "available"}` or `{"status": "unavailable"}`, and the config branches on `status`.

The sidebar's flow view lists exactly the names the handlers must define, plus any custom action types whose handler is registered in code rather than named in the config. Transition-only functions are not on the list.

## Running it

```python
import handlers  # the module above
from pipecat.flows import Flow, FlowConfig, FlowManager

config = FlowConfig.from_file("flow.yaml")  # structure validated here
flow = Flow(config, handlers=handlers)  # references validated here

flow_manager = FlowManager(
    llm=llm,
    context_aggregator=context_aggregator,
    worker=worker,
    global_functions=flow.global_functions,
)
flow_manager.state.update({"restaurant_name": "Luigi's"})  # fills {{ restaurant_name }}


@transport.event_handler("on_client_connected")
async def on_client_connected(transport, client):
    await flow_manager.initialize(flow.initial_node)
```

`handlers` holds the direct functions for the config's tools and the callables for its actions: a module, any object whose attributes are the callables, a mapping of names to callables, or a list of those. A list lets tools and action handlers live in separate modules; a name that resolves to different callables in more than one of them is a construction error rather than a silent choice. Only the names the config references are looked up.

Loading: `FlowConfig.from_file` reads a `.yaml`, `.yml`, or `.json` file; `from_yaml` and `from_json` take text, for a config fetched from a database or CMS at session start; Pydantic's `model_validate` takes a dict that is already parsed. A YAML config can keep long prompts in their own files with `!include path`, resolved relative to the config by `from_file`, or by `from_yaml(text, base_dir=...)`. The editor keeps such references as written and shows them as `!include path`; it cannot read the files in the browser, so an include standing in for a whole list, such as `task_messages: !include tasks.yaml`, reads as a schema error in the editor even though Pipecat loads it.

Validation happens in two passes before the bot takes a call, and a third at each node:

- **Loading** validates structure: the initial node exists, every destination names a node, every branch has a field and at least one case, every transition-only function has a description and a node. The editor makes the same checks, against the same schema, in the same words.
- **Constructing the `Flow`** validates references to code: every tool and handler resolves to exactly one callable, and every tool passes signature validation. Every problem is reported at once as a `FlowReferenceError`, so constructing the `Flow` and starting the bot is the smoke test for a config.
- **Entering a node** renders its placeholders from state. A key that is not there raises then, so set session facts before `initialize()` and have handlers store what later prompts read.

For a complete bot, see the directories under `examples/flows/yaml/` in the Pipecat repository: each holds a `flow.yaml`, a `handlers.py`, and a `bot.py`.

## References

- [Pipecat Flows API Reference](https://reference-flows.pipecat.ai/en/latest/)
- [Feature Guide](https://docs.pipecat.ai/guides/features/pipecat-flows)
- [Pipecat Flows examples](https://github.com/pipecat-ai/pipecat/tree/main/examples/flows)
