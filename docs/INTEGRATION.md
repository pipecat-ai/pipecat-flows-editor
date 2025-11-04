# Pipecat Integration Guide

This document explains how flows exported from the visual editor are integrated into Pipecat applications.

## Overview

The exported JSON from the editor is a **flow configuration** that defines:
- The graph structure (nodes and edges)
- Node types and their data/configuration
- Edge conditions and routing logic
- Flow metadata

However, **Pipecat Flows uses a programmatic API** where flows are created dynamically in Python using `NodeConfig` objects. The JSON from the editor serves as a blueprint that you translate into Python code using the `FlowManager` API.

## Actual Pipecat Flows API Pattern

Based on the [official example](https://github.com/pipecat-ai/pipecat-flows/blob/main/examples/food_ordering.py), Pipecat Flows uses:

1. **`FlowManager`** - Manages flow execution and state
2. **`NodeConfig`** - Defines nodes programmatically with:
   - `name` - Node identifier
   - `role_messages` - System messages defining bot role/personality
   - `task_messages` - Instructions for the current conversation step
   - `functions` - Available function tools (using `FlowsFunctionSchema`)
   - `pre_actions` / `post_actions` - Actions before/after node execution
3. **Function handlers** - Return `(FlowResult, NodeConfig | None)` tuples
   - The result updates flow state
   - The next `NodeConfig` determines flow progression
4. **`flow_manager.state`** - Shared dictionary for flow state
5. **`flow_manager.initialize(node)`** - Starts the flow

## Integration Approach

Since Pipecat Flows uses programmatic node creation rather than static JSON loading, you have two options:

### Option 1: Use JSON as a Design Blueprint

The exported JSON serves as documentation/specification. You manually implement nodes in Python:

```python
from pipecat_flows import FlowManager, NodeConfig, FlowsFunctionSchema, FlowArgs, FlowResult

# Your exported JSON tells you the structure, but you implement it in Python:

def create_greet_node() -> NodeConfig:
    """Based on your 'greet' message node in the editor"""
    return NodeConfig(
        name="greet",
        task_messages=[
            {
                "role": "system",
                "content": "Greet the user warmly. Say: Welcome to Pipecat Pizza!"
            }
        ]
    )

def create_ask_node() -> NodeConfig:
    """Based on your 'ask' llm_call node in the editor"""
    async def process_order(args: FlowArgs, flow_manager: FlowManager) -> tuple[FlowResult, NodeConfig]:
        # Extract data from LLM response
        order = extract_order_from_context(flow_manager.state)
        flow_manager.state["order"] = order
        return FlowResult(), create_confirm_node()
    
    select_order_func = FlowsFunctionSchema(
        name="select_order",
        handler=process_order,
        description="Record the user's order",
        properties={
            "items": {"type": "string", "description": "Order items"},
        },
        required=["items"]
    )
    
    return NodeConfig(
        name="ask",
        task_messages=[
            {
                "role": "system",
                "content": "You are a helpful pizza ordering assistant. Ask what they'd like to order."
            }
        ],
        functions=[select_order_func],
    )

def create_confirm_node() -> NodeConfig:
    """Based on your 'decision' node with edge conditions"""
    async def complete_order(args: FlowArgs, flow_manager: FlowManager) -> tuple[None, NodeConfig]:
        return None, create_end_node()
    
    async def retry_order(args: FlowArgs, flow_manager: FlowManager) -> tuple[None, NodeConfig]:
        return None, create_ask_node()
    
    complete_func = FlowsFunctionSchema(
        name="complete_order",
        handler=complete_order,
        description="User confirms order is correct",
        properties={},
        required=[],
    )
    
    retry_func = FlowsFunctionSchema(
        name="retry_order",
        handler=retry_order,
        description="User wants to change their order",
        properties={},
        required=[],
    )
    
    return NodeConfig(
        name="confirm",
        task_messages=[
            {
                "role": "system",
                "content": """Read back the order. If correct, user will use complete_order. 
                If they want changes, they'll use retry_order."""
            }
        ],
        functions=[complete_func, retry_func],
    )

def create_end_node() -> NodeConfig:
    return NodeConfig(
        name="end",
        task_messages=[
            {"role": "system", "content": "Thank the user and end the conversation."}
        ],
        post_actions=[{"type": "end_conversation"}],
    )

# Initialize FlowManager
flow_manager = FlowManager(
    task=task,
    llm=llm,
    context_aggregator=context_aggregator,
    transport=transport,
)

# Start the flow
await flow_manager.initialize(create_greet_node())
```

### Option 2: Generate Python Code from JSON (Future Enhancement)

A code generator could translate editor JSON into Python `NodeConfig` functions:

```python
# Generated from exported JSON
def create_nodes_from_json(flow_json: dict) -> dict[str, NodeConfig]:
    """Convert editor JSON to NodeConfig objects"""
    nodes = {}
    
    for node_data in flow_json["nodes"]:
        node_id = node_data["id"]
        node_type = node_data["type"]
        data = node_data.get("data", {})
        
        if node_type == "message":
            nodes[node_id] = NodeConfig(
                name=node_id,
                task_messages=[{
                    "role": "system",
                    "content": data.get("text", "")
                }]
            )
        elif node_type == "llm_call":
            # Create function handler based on node data
            # ... implementation
            pass
        # ... handle other node types
    
    return nodes
```

**Note**: This would require implementing a JSON → Python code generator.

## Key Mappings: Editor JSON → Python API

| Editor Concept | Python Implementation |
|----------------|----------------------|
| Node `id` | `NodeConfig.name` |
| Node `type` | Determines `NodeConfig` structure |
| Node `data.text` (message) | `task_messages[0].content` |
| Node `data.model/prompt/system` (llm_call) | Configured in LLM service + `task_messages` |
| Node `data.expression` (decision) | Logic in function handlers |
| Edge `condition` | Routing logic in function return values |
| Flow `context` | `flow_manager.state` dictionary |
| Edge routing | Function handlers return `(result, next_node)` |

## Complete Example: Food Ordering Flow

Based on the [official example](https://github.com/pipecat-ai/pipecat-flows/blob/main/examples/food_ordering.py):

```python
from pipecat_flows import (
    FlowManager,
    NodeConfig,
    FlowsFunctionSchema,
    FlowArgs,
    FlowResult,
)
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.task import PipelineTask

# Set up your Pipecat pipeline (STT, LLM, TTS, transport)
pipeline = Pipeline([...])
task = PipelineTask(pipeline)

# Create nodes programmatically
def create_initial_node() -> NodeConfig:
    async def choose_pizza(args: FlowArgs, flow_manager: FlowManager) -> tuple[None, NodeConfig]:
        return None, create_pizza_node()
    
    async def choose_sushi(args: FlowArgs, flow_manager: FlowManager) -> tuple[None, NodeConfig]:
        return None, create_sushi_node()
    
    choose_pizza_func = FlowsFunctionSchema(
        name="choose_pizza",
        handler=choose_pizza,
        description="User wants to order pizza",
        properties={},
        required=[],
    )
    
    return NodeConfig(
        name="initial",
        role_messages=[{
            "role": "system",
            "content": "You are an order-taking assistant..."
        }],
        task_messages=[{
            "role": "system",
            "content": "Ask if they want pizza or sushi..."
        }],
        functions=[choose_pizza_func, choose_sushi_func],
    )

def create_pizza_node() -> NodeConfig:
    async def select_pizza(args: FlowArgs, flow_manager: FlowManager):
        size = args["size"]
        pizza_type = args["type"]
        
        # Store in flow state
        flow_manager.state["order"] = {
            "type": "pizza",
            "size": size,
            "pizza_type": pizza_type,
        }
        
        return FlowResult(), create_confirmation_node()
    
    select_func = FlowsFunctionSchema(
        name="select_pizza_order",
        handler=select_pizza,
        description="Record pizza order",
        properties={
            "size": {"type": "string", "enum": ["small", "medium", "large"]},
            "type": {"type": "string", "enum": ["pepperoni", "cheese", "supreme"]},
        },
        required=["size", "type"],
    )
    
    return NodeConfig(
        name="choose_pizza",
        task_messages=[{
            "role": "system",
            "content": "Handle pizza order..."
        }],
        functions=[select_func],
    )

# Initialize FlowManager
flow_manager = FlowManager(
    task=task,
    llm=llm,
    context_aggregator=context_aggregator,
    transport=transport,
)

# Start the flow
@transport.event_handler("on_client_connected")
async def on_client_connected(transport, client):
    await flow_manager.initialize(create_initial_node())
```

## Differences from Editor JSON

The editor's JSON format is **declarative** (describes what), while Pipecat Flows Python API is **programmatic** (describes how):

1. **Dynamic Node Creation**: Nodes are created as Python functions, not loaded from static JSON
2. **Function-Based Routing**: Flow progression happens via function return values, not edge conditions
3. **State Management**: Uses `flow_manager.state` dict, not a separate context object
4. **LLM Integration**: LLM calls are implicit in `task_messages`, not explicit `llm_call` nodes

## Recommendations

1. **Use Editor for Design**: Design your flow visually in the editor
2. **Manual Implementation**: Translate the design to Python `NodeConfig` code
3. **JSON as Reference**: Keep exported JSON as documentation/specification
4. **Validate in Editor**: Use editor validation to catch structural issues before coding

## References

- [Official Food Ordering Example](https://github.com/pipecat-ai/pipecat-flows/blob/main/examples/food_ordering.py)
- [Pipecat Flows API Reference](https://reference-flows.pipecat.ai/en/latest/)
- [Pipecat Flows Guide](https://docs.pipecat.ai/guides/features/pipecat-flows)
