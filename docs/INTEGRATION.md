# Pipecat Integration Guide

This document explains how a flow built in the editor runs inside a Pipecat application.

## The seam

Pipecat Flows splits a configured conversation along one line:

- **The YAML owns the graph.** Which nodes exist, what each one says, which tools each offers, where each tool leads, the pre and post actions, and the template variables for personalization. This is what the editor edits.
- **Python owns the tools.** Every function the LLM can call is a direct function in a tools module: its signature and docstring define what the LLM sees, and its body does the work. Action handlers and custom action types live there too.

The YAML references tools by name and never contains a description or a parameter. That is why the editor has no tool schema forms: the tool's description and parameters come from the code.

## Flow lifecycle

1. **Design** – Build the flow in the editor. Use the Flow panel to see which tool names, action handlers, and `{{ variables }}` the config refers to.
2. **Save** – Download `<name>.yaml`.
3. **Write the tools** – Implement each referenced name as a direct function in a Python module.
4. **Run** – Load the config, join it to the tools with `Flow`, and hand the result to `FlowManager`.

## The format

The same graph as Pipecat's `examples/flows/food_ordering.py`, as data:

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
        handler: check_kitchen_status # action handler in the tools module
    functions:
      - name: choose_pizza # tool in the tools module
        transition_to: choose_pizza
      - name: choose_sushi
        transition_to: choose_sushi

  choose_pizza:
    task_messages:
      - role: developer
        content: Take a pizza order. Call select_pizza_order once you have size and type.
    functions:
      - name: select_pizza_order
        transition_to: confirm

  confirm:
    task_messages:
      - role: developer
        content: Read the order back and ask whether anything should change.
    functions:
      - name: complete_order
        transition_to: end
      - name: revise_order
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

| Key                                | Meaning                                                                                                                                |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `initial_node`                     | Name of the node the flow starts in.                                                                                                   |
| `nodes.<name>.role_message`        | The bot's role, sent as the system instruction on entering the node. Persists until another node sets its own.                         |
| `nodes.<name>.task_messages`       | What the LLM should do at this node. Roles are `developer`, `user`, or `assistant`; Pipecat maps `developer` to `system` where needed. |
| `nodes.<name>.functions`           | Tools offered at this node, each a `name` and an optional `transition_to`.                                                             |
| `nodes.<name>.pre_actions`         | Actions run before the LLM responds. Built-in types are `tts_say` and `end_conversation`; `function` names a `handler`.                |
| `nodes.<name>.post_actions`        | Actions run after the LLM responds.                                                                                                    |
| `nodes.<name>.context_strategy`    | `append` or `reset`. Omitted, the `FlowManager`'s strategy applies.                                                                    |
| `nodes.<name>.respond_immediately` | Whether the LLM responds as soon as the node is entered. Defaults to true.                                                             |
| `global_functions`                 | Tools offered at every node.                                                                                                           |

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

Non-string values match a case by their string form, so `flag: true` matches a `"True"` case. A result without the named field is an error.

### Variables

`{{ name }}` placeholders in `role_message`, `task_messages[].content`, and action `text` are substituted when the `Flow` is constructed. Substitution only, no logic; a missing variable raises at construction.

The authoritative definition of the format is Pipecat's JSON Schema, generated from the `FlowConfig` model and vendored in this repo at `lib/schema/flow_config.schema.json`.

## The tools module

Tools are ordinary Flows direct functions. They return `(result, None)`: the config owns every transition, so a tool in a configured flow never returns a node. A pure transition is a tool with nothing in it.

```python
# tools.py
from datetime import datetime, timedelta

from pipecat.flows import FlowManager


async def choose_pizza(flow_manager: FlowManager) -> tuple[None, None]:
    """User wants to order pizza."""
    return None, None


async def select_pizza_order(
    flow_manager: FlowManager, size: str, pizza_type: str
) -> tuple[dict, None]:
    """Record the pizza order details.

    Args:
        size (str): One of "small", "medium", or "large".
        pizza_type (str): One of "pepperoni", "cheese", "supreme", or "vegetarian".
    """
    price = {"small": 10.0, "medium": 15.0, "large": 20.0}[size]
    flow_manager.state["order"] = {"type": "pizza", "size": size, "price": price}
    return {"size": size, "type": pizza_type, "price": price}, None


async def get_delivery_estimate(flow_manager: FlowManager) -> tuple[dict, None]:
    """Get a delivery estimate for the current order."""
    eta = datetime.now() + timedelta(minutes=30)
    return {"time": eta.isoformat()}, None


async def check_kitchen_status(action: dict, flow_manager: FlowManager) -> None:
    """Pre-action: check the kitchen is open."""
    ...
```

The Flow panel in the editor lists exactly the names this module must define.

## Running it

```python
import tools  # the module above
from pipecat.flows import Flow, FlowConfig, FlowManager

config = FlowConfig.from_file("food_ordering.yaml")  # structure validated here
flow = Flow(
    config,
    tools=tools,  # only names the YAML references are resolved
    variables={"restaurant_name": "Luigi's"},
)  # references and signatures validated here

flow_manager = FlowManager(
    llm=llm,
    context_aggregator=context_aggregator,
    worker=worker,
    global_functions=flow.global_functions,
)


@transport.event_handler("on_client_connected")
async def on_client_connected(transport, client):
    await flow_manager.initialize(flow.initial_node)
```

`FlowConfig.from_yaml(text)` loads from a string, for a config fetched from a database or CMS at session start, and `FlowConfig.from_file` also accepts `.json`. `Flow` takes a module or a mapping of names to callables; anything in the module the YAML does not mention is left alone.

Validation happens in two passes, both before the bot takes a call:

- **Loading** validates structure: the initial node exists, every destination names a node, every branch has a field and at least one case. The editor makes the same checks, against the same schema.
- **Constructing the `Flow`** validates references to code: every tool and handler resolves, every tool passes signature validation, every template variable is supplied.

For a complete bot, see `examples/flows/food_ordering_yaml.py` and `food_ordering_tools.py` in the Pipecat repository.

## References

- [Pipecat Flows API Reference](https://reference-flows.pipecat.ai/en/latest/)
- [Feature Guide](https://docs.pipecat.ai/guides/features/pipecat-flows)
- [Pipecat Flows examples](https://github.com/pipecat-ai/pipecat/tree/main/examples/flows)
