# Pipecat Flows Visual Editor

Next.js + TypeScript + Tailwind + React Flow based visual editor for dynamic Pipecat Flows. Runs 100% in the browser with localStorage autosave.

## References

- Pipecat Flows repo: https://github.com/pipecat-ai/pipecat-flows
- Guide: https://docs.pipecat.ai/guides/features/pipecat-flows
- API Reference: https://reference-flows.pipecat.ai/en/latest/

## Features

- **Visual Flow Editor**: Drag-and-drop interface for building Pipecat flows
- **Node Palette**: Pre-configured node types (start, end, message, LLM call, decision, etc.)
- **Inspector Panel**: Schema-driven forms for editing node properties
- **JSON Editor**: Monaco-based JSON editor with live validation
- **Import/Export**: Validate and import/export flows as JSON
- **Autosave**: Automatic localStorage saves of current flow state
- **Undo/Redo**: Full undo/redo history with keyboard shortcuts
- **Keyboard Shortcuts**:
  - `Cmd/Ctrl+Z` - Undo
  - `Cmd/Ctrl+Shift+Z` or `Cmd/Ctrl+Y` - Redo
  - `Delete/Backspace` - Delete selected node
  - `Cmd/Ctrl+D` - Duplicate selected node
- **Example Flows**: Bundled example flows for quick start
- **Validation**: Real-time schema validation with error reporting

## Development

1. Install dependencies

```bash
npm install # or pnpm/yarn
```

2. Run the dev server

```bash
npm run dev
```

Open http://localhost:3000.

## Testing

Run unit tests:

```bash
npm test
```

Run Playwright E2E tests:

```bash
npm run test:e2e
```

## Data Model

All flows are stored as JSON and must conform to the Pipecat Flows schema. See [docs/SCHEMA.md](./docs/SCHEMA.md) for the complete schema reference.

### Key Constraints

- **Node IDs**: Must be unique within a flow
- **Edge Endpoints**: Must reference existing node IDs
- **Required Fields**: All nodes must have `id`, `type`, `position`, and `data`
- **Minimum Nodes**: A flow must have at least 1 node

## Persistence

- **Autosave**: Changes are automatically saved to `localStorage` after a 400ms debounce
- **No Server**: All data stays in the browser; nothing is sent to a server

## Schema Validation

All imported JSON is validated against:
1. **TypeBox Schema**: Runtime validation using Ajv
2. **Custom Graph Rules**: Additional checks for uniqueness and connectivity

Invalid flows cannot be imported and will show error toasts with details.

## Example Flows

Example flows are included in `lib/examples/`:
- `minimal.json` - Basic start -> end flow
- `food_ordering.json` - Simple food ordering conversation flow

Load examples from the toolbar dropdown.

## Integration with Pipecat

The exported JSON from this editor is a **flow configuration** that defines the graph structure, nodes, edges, and conditions. To use it in Pipecat:

1. **Export** your flow from the editor (toolbar → Export button)
2. **Install** Pipecat Flows: `pip install pipecat pipecat-ai-flows`
3. **Load** the JSON in Python: `FlowConfig.from_dict(json.load(f))`
4. **Register** node handler functions for each node type
5. **Execute** the flow using `Pipeline` and `PipelineTask`

See [docs/INTEGRATION.md](./docs/INTEGRATION.md) for a complete integration guide with examples.

## Tech Stack

- **Next.js 14** (App Router)
- **React 19**
- **TypeScript**
- **Tailwind CSS v4**
- **React Flow** - Graph canvas
- **Monaco Editor** - JSON editing
- **TypeBox** - Schema definition
- **Ajv** - Runtime validation

## Contributing

When adding new node types:
1. Add the type to `lib/schema/flow.schema.ts` if it's a new core type
2. Add a template in `lib/nodes/templates.ts`
3. Create an inspector form component in `components/inspector/forms/` if needed
4. Update the schema docs

See [docs/SCHEMA.md](./docs/SCHEMA.md) for schema details.

