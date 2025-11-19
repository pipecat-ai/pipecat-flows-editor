# Pipecat Flows Editor

Next.js + TypeScript + Tailwind + React Flow visual editor tailored to Pipecat Flows. The editor runs entirely in the browser, syncs state to `localStorage`, and exports Pipecat-ready JSON _and_ Python code.

## References

- Online editor: https://flows.pipecat.ai
- Pipecat Flows repo: https://github.com/pipecat-ai/pipecat-flows
- Feature guide: https://docs.pipecat.ai/guides/features/pipecat-flows
- API reference: https://reference-flows.pipecat.ai/en/latest/

## Highlights

- **NodeConfig-first modeling** – Nodes map 1:1 to Pipecat `NodeConfig` objects (`role_messages`, `task_messages`, `functions`, actions, context strategy, etc.).
- **Inspector-driven editing** – Schema-backed forms for messages, function schemas, decisions, actions, context strategy, and response controls.
- **Decision routing visualized** – Function-level decisions appear as inline decision nodes and translate directly to Python conditionals.
- **JSON + Python export** – Download the validated flow JSON or generate runnable Python scaffolding via the built-in code generator.
- **Schema validation** – TypeBox + Ajv plus custom graph rules (unique IDs, valid references) before import/export.
- **Local-first UX** – Autosave, undo/redo, keyboard shortcuts, dark mode, example flows, and Monaco JSON viewer.

## Getting Started

Install dependencies:

```bash
npm install
```

Run the dev server:

```bash
npm run dev
```

Open http://localhost:3000 to launch the editor.

## Testing

```bash
npm test      # Vitest (unit + component tests)
npm run lint  # ESLint + TypeScript rules
```

## Working With Flows

- Flows are saved as JSON documents that follow `lib/schema/flow.schema.ts`. Detailed field descriptions live in [docs/SCHEMA.md](./docs/SCHEMA.md).
- The node palette includes `initial`, `node`, and `end` templates. All nodes ultimately emit the same Pipecat `NodeConfig`, but templates give sensible defaults.
- Routing is controlled by function metadata:
  - `next_node_id` wires one function directly to the next node.
  - `decision` objects attach Python snippets and conditionals that become decision nodes in the canvas and `if/elif` blocks in generated Python.
- Decision nodes shown on the canvas are visualization helpers; they are not persisted as standalone nodes. Instead, decision metadata is stored on the originating function.
- Edges are derived automatically from function routing. When you delete or rename nodes, the UI surfaces broken references so you can fix them before exporting.

### Persistence

- Every edit debounces into `localStorage`, so reloading the page restores the last working draft.
- No server calls are made; the editor operates entirely client-side.

### Import / Export

Toolbar actions let you:

- **Import JSON** – Validates against the schema plus custom graph rules, then rehydrates the canvas.
- **Export JSON** – Serializes the current graph into Pipecat Flow JSON.
- **Export Python** – Validates the flow, runs `lib/codegen/pythonGenerator.ts`, and downloads a Python file with `NodeConfig` factories, handler scaffolding, optional decision routing, and FlowManager wiring comments.

See [docs/INTEGRATION.md](./docs/INTEGRATION.md) for full integration steps.

### Example Flows

Example definitions live in `lib/examples/` (e.g., `minimal.json`, `food_ordering.json`). Load them via **Load Example** in the toolbar to see end-to-end patterns.

## Tech Stack

- **Next.js 16** (App Router)
- **React 19** + **@xyflow/react** for the canvas
- **TypeScript**
- **Tailwind CSS v4** + custom UI primitives
- **Monaco Editor** for JSON inspection
- **TypeBox + Ajv** for schema + validation
- **Zustand** for editor state

## Contributing

When expanding capabilities:

1. Update `lib/schema/flow.schema.ts` and `docs/SCHEMA.md` for any schema changes.
2. Add or tweak templates in `lib/nodes/templates.ts`.
3. Extend inspector forms under `components/inspector/forms/` to expose new fields.
4. Update tests (`tests/`) and docs as needed.

See [docs/SCHEMA.md](./docs/SCHEMA.md) for authoritative schema details.
