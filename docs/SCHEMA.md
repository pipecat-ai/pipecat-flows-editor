# Pipecat Flows Schema

This document describes the JSON schema and data model for Pipecat Flows.

## Overview

The flow schema is defined using TypeBox (`lib/schema/flow.schema.ts`) and validated at runtime with Ajv. All flows must conform to this schema to be imported into the editor.

## Schema Reference

### Flow Schema (`FlowSchema`)

A flow document consists of:

```typescript
{
  $schema?: string;          // Optional schema URI
  $id?: string;               // Optional schema ID
  meta: FlowMeta;            // Flow metadata
  context?: Record<string, any>; // Optional context variables
  nodes: FlowNode[];         // Array of nodes (min 1)
  edges: FlowEdge[];         // Array of edges
}
```

### Flow Metadata (`FlowMeta`)

```typescript
{
  name: string;              // Flow name (required, min length 1)
  version?: string;          // Version string (default: "0.1.0")
  description?: string;      // Optional description
}
```

### Flow Node (`FlowNode`)

```typescript
{
  id: string;                // Unique node ID (required, min length 1)
  type: NodeType;            // Node type (see below)
  position: { x: number, y: number }; // Canvas position
  data: Record<string, any>; // Node-specific data
}
```

### Node Types

Supported node types:
- `start` - Flow entry point
- `end` - Flow exit point
- `message` - Send a message
- `llm_call` - LLM invocation
- `tool_call` - Tool/function call
- `decision` - Conditional branch
- `merge` - Merge multiple paths
- `switch` - Multi-case switch
- `subflow` - Nested subflow
- `event` - Event handler
- `loop` - Loop construct
- `function` - Custom function
- `wait` - Wait/delay
- `http_call` - HTTP request
- `custom` - Custom node type

### Flow Edge (`FlowEdge`)

```typescript
{
  id: string;                // Unique edge ID (required, min length 1)
  source: string;            // Source node ID (required, min length 1)
  target: string;            // Target node ID (required, min length 1)
  label?: string;            // Optional edge label
  priority?: number;         // Optional priority (integer, >= 0)
  condition?: EdgeCondition; // Optional edge condition
}
```

### Edge Condition (`EdgeCondition`)

```typescript
{
  expression?: string;       // Condition expression
  language?: 'python' | 'jinja' | 'dsl'; // Expression language
}
```

## Validation Rules

### Schema Validation

The schema enforces:
- Required fields are present
- String fields meet minimum length requirements
- Number fields are within valid ranges
- Arrays meet minimum item requirements

### Custom Graph Rules

Additional validations (see `lib/validation/validator.ts`):
1. **Unique Node IDs**: All node IDs must be unique within the flow
2. **Edge Endpoint Existence**: All edge `source` and `target` IDs must reference existing nodes

## Node-Specific Data

Node types may have specific data fields:

### Message Node
```typescript
{
  text: string; // Message content
}
```

### LLM Call Node
```typescript
{
  model: string;      // Model identifier (e.g., "gpt-4o")
  system?: string;   // System prompt
  prompt?: string;   // User prompt
  temperature?: number; // Temperature (0-2)
}
```

### Decision Node
```typescript
{
  expression: string;           // Decision expression
  language?: 'dsl' | 'python' | 'jinja'; // Expression language
}
```

Other node types may have additional fields as needed. The schema allows `data` to be flexible (`Record<string, any>`) to accommodate node-specific requirements.

## Example

See `lib/examples/` for complete example flows.

## Schema Versioning

The schema includes `$id` and `$schema` fields for versioning:
- Schema ID: `https://flows.pipecat.ai/schema/flow.json`
- Use the `meta.version` field to track flow document versions

