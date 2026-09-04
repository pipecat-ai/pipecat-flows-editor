# Pipecat Flows Editor

A visual editor for Pipecat Flows. The document it edits is Pipecat's `FlowConfig` YAML: the nodes of a conversation, what each one says, which tools each offers, and where each tool leads. The canvas is a view of that file. The editor runs entirely in the browser, keeps a draft in `localStorage`, and saves the same YAML your Pipecat application loads.

## References

- Online editor: https://flows.pipecat.ai
- Pipecat repo: https://github.com/pipecat-ai/pipecat
- Feature guide: https://docs.pipecat.ai/guides/features/pipecat-flows
- Flows API reference: https://reference-flows.pipecat.ai/en/latest/

## Highlights

- **The YAML is the document** – Open a `FlowConfig` file, edit it on the canvas or in the YAML pane, and save it. Comments, key order, and block scalars in a hand-written file survive the round trip.
- **Two views, one document** – The canvas and the YAML pane stay in step: a change on either side updates the other, with problems shown inline in the pane.
- **Routing as data** – A function is a tool name and a destination: a node, or a branch table keyed on a field of the tool's result. A node card lists its functions as rows, a branch's cases as sub-rows, and each row has its own port.
- **Pipecat's schema** – Validation uses the JSON Schema Pipecat ships for `FlowConfig`, vendored and pinned, plus the same cross-reference checks Pipecat's own loader makes.
- **The handoff to code is a list** – The Flow panel lists every tool and action handler the config references and every `{{ variable }}` it uses, so you know what the Python side must provide.
- **Local-first UX** – Autosave, undo/redo, keyboard shortcuts, dark mode, auto-layout on open, and Pipecat's own example flows.

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

- A flow is a `FlowConfig` YAML file. Its shape is defined by Pipecat's JSON Schema, vendored at `lib/schema/flow_config.schema.json`; the field descriptions there are Pipecat's own. See [docs/INTEGRATION.md](./docs/INTEGRATION.md) for the format and how a Pipecat application loads it.
- The canvas owns structure and the inspector owns content. Hover a node and press its "+" to add a function: leading to a next node, an end node, or a branch on the tool's result, or staying on the node. Every node is reachable by construction. A branch has an "add case" row. Double-click a node name, a tool name, or a case value to rename it in place; hover a row for its "×". Delete removes what is selected: an edge's route, a row, or a node.
- The initial node is whichever node `initial_node` names; use "Make initial node" in a node's context menu to move it. An end node is one with an `end_conversation` post-action. Every node has the same shape.
- A node's name is its key in the config. Renaming a node rewrites every destination that pointed at it.
- Routing lives on functions as `transition_to`: a node name, or a branch table with `field`, `cases`, and an optional `default`. Dragging from a row's port sets that row's destination; dragging from the node's bottom handle adds a function, and from a branch's "add case" row adds a case.
- Tool descriptions and parameters are not in the config. They come from the direct functions in your Python tools module, referenced by name.
- Edges are derived from the routing data. Deleting or renaming nodes surfaces broken references on the canvas and in the YAML pane.
- Canvas positions are not part of the document. A freshly opened file is auto-laid out; positions are then kept in `localStorage`, keyed by flow name.

### Persistence

- Every edit debounces into `localStorage`, so reloading the page restores the last working draft.
- No server calls are made; the editor operates entirely client-side.

### Open / Save

Toolbar actions let you:

- **Open** – Read a `FlowConfig` file as YAML or JSON, validate it, and lay it out. A file in the editor's old JSON format is converted; what cannot convert (tool schemas, decisions) is reported by name.
- **Save** – Download the flow as `<name>.yaml`, merged into the document it was opened from so comments are preserved.
- **Layout** – Lay the nodes out automatically, the way a freshly opened file is.
- **Sidebar** – Always open: it shows the selected node, or the flow when nothing is selected, with the flow's name, its global functions, and the tools, action handlers, and variables the config refers to. It collapses from its header and reopens from the toolbar.
- **Show YAML** – Edit the document itself, with parse, schema, and reference problems marked inline.

### Example Flows

The examples under **Load Example** are served from `public/examples/`. Food ordering and restaurant reservation are Pipecat's own, copied verbatim from `examples/flows/` in the Pipecat repository; patient intake is a port of the Python example there; order status and lead qualification are written for the editor. Each file's header comment lists the tools its module must define.

## Tech Stack

- **Next.js 16** (App Router)
- **React 19** + **@xyflow/react** for the canvas
- **TypeScript**, with the `FlowConfig` types generated from Pipecat's schema
- **Tailwind CSS v4** + custom UI primitives
- **yaml** for parsing with comment preservation, **Ajv** for schema validation, **dagre** for auto-layout
- **Monaco Editor** for the YAML pane
- **Zustand** for editor state

## Contributing

When Pipecat's `FlowConfig` changes:

1. Copy the new `flow_config.schema.json` over `lib/schema/flow_config.schema.json` and update the source record in `lib/schema/flowConfig.ts`.
2. Run `npm run gen:types` to regenerate `lib/schema/flowConfig.generated.ts`.
3. Mirror any new validator in `lib/validation/flowConfigValidator.ts`.
4. Extend the inspector forms under `components/inspector/forms/` to expose new fields, and update tests under `tests/`.
