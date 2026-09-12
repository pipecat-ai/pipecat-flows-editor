# Pipecat Flows Editor

A visual editor for Pipecat Flows. Build a flow with a coding agent, then visualize it here: validate it, fix it, and export it to your Pipecat project. The document it edits is Pipecat's `FlowConfig` YAML: the nodes of a conversation, what each one says, which tools each offers, and where each tool leads. The canvas is a view of that file. The editor runs entirely in the browser, keeps a draft in `localStorage`, and saves the same YAML your Pipecat application loads.

## References

- Online editor: https://flows.pipecat.ai
- Pipecat repo: https://github.com/pipecat-ai/pipecat
- Feature guide: https://docs.pipecat.ai/guides/features/pipecat-flows
- Flows API reference: https://reference-flows.pipecat.ai/en/latest/

## Highlights

- **The YAML is the document** – Open a `FlowConfig` file, edit it on the canvas or in the YAML pane, and save it. Comments, key order, block scalar styles, and every key in a hand-written file survive the round trip; the one change on save is that long lines, folded or plain, are re-wrapped at 80 columns.
- **Two views, one document** – The canvas and the YAML pane stay in step: a change on either side updates the other, with problems shown inline in the pane.
- **Routing as data** – A function is a tool name and a destination: a node, or a branch table keyed on a field of the tool's result. A function that only moves the conversation is written in the config alone, as a transition-only entry with a description, and needs no Python. A node card lists its functions as rows, a branch's cases as sub-rows, and each row has its own port.
- **Pipecat's schema and checks** – Validation uses the JSON Schema Pipecat ships for `FlowConfig`, vendored and pinned, plus the same cross-reference checks its loader makes and the same graph warnings it reports: unreachable nodes, dead ends, and branches that always go one place. Every finding uses Pipecat's `FlowIssue` shape and codes.
- **The handoff to code is a list** – The Flow panel lists every tool and action handler the config references and every `{{ key }}` placeholder its prompts read from the manager's state, so you know what the Python side must provide.
- **What a node does, on the card** – Besides its functions, a card shows the node's actions as a short script: what it says or runs on entry above the functions, what it says or runs on exit below. Click a line to open the node's actions.
- **Built for flows that arrive written** – Most flows are written by an agent or by hand and opened here to be seen and corrected. The start screen offers four ways in: open a file, paste YAML, start from an example, or a blank flow. A file dropped anywhere or YAML pasted anywhere opens at once.
- **Local-first UX** – Autosave, undo/redo, keyboard shortcuts, light and dark themes, auto-layout on open, and Pipecat's own example flows.
- **pipecat.ai's design language** – Zinc tokens, Geist type, hairline chrome, and the site's pixel-stream animation on the landing page and start screen, so the editor and the site read as one product.

## Getting Started

Install dependencies:

```bash
npm install
```

Run the dev server:

```bash
npm run dev
```

Open http://localhost:3000 for the landing page, or http://localhost:3000/editor to go straight to the editor's start screen.

## Testing

```bash
npm test      # Vitest (unit + component tests)
npm run lint       # ESLint
npm run typecheck  # TypeScript
```

## Working With Flows

- A flow is a `FlowConfig` YAML file. Its shape is defined by Pipecat's JSON Schema, vendored at `lib/schema/flow_config.schema.json`; the field descriptions there are Pipecat's own. See [docs/INTEGRATION.md](./docs/INTEGRATION.md) for the format and how a Pipecat application loads it.
- The canvas owns structure and the inspector owns content. Hover a node and press its "+" to add a function: leading to a next node, an end node, or a branch on the tool's result, or staying on the node. Every node is reachable by construction. A branch has an "add case" row. Double-click a node name, a tool name, or a case value to rename it in place; hover a row for its "×". Delete removes what is selected: an edge's route, a row, or a node.
- A card lists the node's pre-actions above its functions and its post-actions below: a `tts_say` as its text in quotes, a `function` action or custom type by its handler or name. Each block shows two lines and folds the rest into one; hover a line for the full sentence, click it to open the node's Actions tab. A node whose post-actions end the conversation is drawn as an end node instead.
- Every node needs task messages; the role message is optional and persists across transitions until another node sets its own, so setting it on the initial node covers the whole flow.
- The initial node is whichever node `initial_node` names; use "Make initial node" in a node's context menu to move it. An end node is one with an `end_conversation` post-action. Every node has the same shape.
- A node's name is its key in the config. Renaming a node rewrites every destination that pointed at it.
- Routing lives on functions as `transition_to`: a node name, or a branch table with `field`, `cases`, and an optional `default`. Dragging from a row's port sets that row's destination; dragging from the node's bottom handle adds a function, and from a branch's "add case" row adds a case.
- A `role_message` or a message's `content` may be `!include path`, which Pipecat fills in from a file beside the config when it loads. The editor keeps the reference as written and shows it as `!include path`; it cannot read the file, so placeholders in it are not listed. Type the same form into a field to make one.
- Tool descriptions and parameters are not in the config. They come from the direct functions in your Python handlers, referenced by name. The exception is a transition-only function, which the config defines entirely: a name, a description for the LLM, and the node it leads to. Toggle it on a function in the sidebar.
- `{{ key }}` in a role message, a task message, or a `tts_say` text is filled from `flow_manager.state` each time the node is entered. `{{ order.size }}` reads into a stored mapping, and `\{{ key }}` is a literal. The Flow panel lists the keys the prompts read.
- Edges are derived from the routing data. Deleting or renaming nodes surfaces broken references on the canvas and in the YAML pane.
- Canvas positions are not part of the document. A freshly opened file is auto-laid out; positions are then kept in `localStorage`, keyed by flow name.

### Persistence

- Every edit debounces into `localStorage`, so reloading the page restores the last working draft.
- The editor makes no network calls; it operates entirely client-side. The landing page fetches the Pipecat repository's star count from GitHub when it renders, revalidated daily, and leaves the badge out if that fails.

### Open / Save

Toolbar actions let you:

- **Open** – Read a `FlowConfig` file as YAML or JSON, validate it, and lay it out. A file in the editor's old JSON format is converted; what cannot convert (tool schemas, decisions) is reported by name.
- **Save** – Download the flow as `<name>.yaml`, merged into the document it was opened from so comments are preserved.
- **Layout** – Lay the nodes out automatically, the way a freshly opened file is.
- **Sidebar** – Always open: it shows the selected node, or the flow when nothing is selected, with the flow's name, its global functions, the issues Pipecat would report, and the tools, action handlers, and state placeholders the config refers to. It collapses from its header and reopens from the toolbar.
- **YAML** – The tab on the canvas's bottom edge, and the "Node YAML" button in the inspector, open the document itself, with parse, schema, and reference problems marked inline.

### Example Flows

The examples under **Load Example** are served from `public/examples/`. Hello world, food ordering, restaurant reservation, patient intake, insurance quote, and podcast interview are Pipecat's own: each is the `flow.yaml` of a directory under `examples/flows/yaml/` in the Pipecat repository, copied verbatim, with a `handlers.py` and a `bot.py` beside it there. Order status and lead qualification are written for the editor; their header comments list the handlers the Python must define and the state keys the prompts read.

## Tech Stack

- **Next.js 16** (App Router)
- **React 19** + **@xyflow/react** for the canvas
- **TypeScript**, with the `FlowConfig` types generated from Pipecat's schema
- **Tailwind CSS v4** + custom UI primitives, on pipecat.ai's zinc tokens and Geist type (via `next/font`) so the editor and the site read as one product
- **yaml** for parsing with comment preservation, **Ajv** for schema validation, **dagre** for auto-layout
- **Monaco Editor** for the YAML pane
- **Zustand** for editor state

## Contributing

`npm run check:schema` compares the vendored schema with Pipecat's at the pinned commit, and `npm run check:schema -- main` with what has shipped. When Pipecat's `FlowConfig` changes:

1. Copy the new `flow_config.schema.json` over `lib/schema/flow_config.schema.json` and update the source record in `lib/schema/flowConfig.ts`.
2. Run `npm run gen:types` to regenerate `lib/schema/flowConfig.generated.ts`.
3. Mirror any new validator in `lib/validation/flowConfigValidator.ts`.
4. Extend the inspector forms under `components/inspector/forms/` to expose new fields, and update tests under `tests/`.
