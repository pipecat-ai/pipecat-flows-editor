"use client";

import { Handle, type NodeProps, Position } from "@xyflow/react";
import {
  AlertTriangle,
  ArrowRight,
  LogOut,
  Play,
  Plug,
  Plus,
  Volume2,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import { useState } from "react";

import { useHoverWithGrace } from "@/hooks/useHoverWithGrace";
import { type ConfigCanvasNode, IN_HANDLE, OUT_HANDLE } from "@/lib/convert/configToCanvas";
import { cardDescription, COMPACT_END, isCompactEnd, NODE_CARD } from "@/lib/layout/autoLayout";
import { type FlowConfigFunction, isBranch } from "@/lib/schema/flowConfig";
import { useEditorStore } from "@/lib/store/editorStore";
import { type ActionLine, cardActionLines } from "@/lib/utils/actionSummary";

import { useCanvasActions, useCanvasNodeTypes } from "./canvasActions";
import InlineText from "./InlineText";
import NodeAddToolbar from "./NodeAddToolbar";

/**
 * How many characters of each name the card shows before an ellipsis. The
 * full text is in the tooltip and when editing. These are independent of the
 * card's width, which is NODE_CARD.width in lib/layout/autoLayout.ts.
 */
export const NAME_LIMITS = { node: 35, tool: 25, caseValue: 25, field: 12 };

/** Which text on the card is being edited in place. */
type Editing = { kind: "node" } | { kind: "function"; functionIndex: number } | null;

/**
 * A node card: the node's name, what it says or runs on entry, the functions
 * that stay on it, and what it says or runs on exit. Functions that lead
 * somewhere are edges leaving the card's one exit at the bottom, labeled
 * with their names; a function whose destination no longer exists stays on
 * the card with a warning until it is routed again. Names rename in place
 * on double-click, rows remove on hover, and the "+" under the card adds a
 * function.
 */
export default function BaseNode({ id, data, selected, type }: NodeProps<ConfigCanvasNode>) {
  const actions = useCanvasActions();
  const [hovering, setHovering] = useHoverWithGrace();
  const [editing, setEditing] = useState<Editing>(null);
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);
  const selectedFunctionIndex = useEditorStore((state) => state.selectedFunctionIndex);

  const nodeTypes = useCanvasNodeTypes();
  const functions = data.functions ?? [];
  // Rows: functions that stay on the node, and transitions to a node that is gone
  type Row = { fn: FlowConfigFunction; functionIndex: number; missing: string | null };
  const rows = functions.flatMap<Row>((fn, functionIndex) => {
    const transition = fn.transition_to;
    if (transition === undefined || transition === null)
      return [{ fn, functionIndex, missing: null }];
    if (isBranch(transition)) return [];
    return nodeTypes.has(transition) ? [] : [{ fn, functionIndex, missing: transition }];
  });
  const script = cardActionLines(data);
  const description = cardDescription(data);
  const hasBelowHeader = script.before.length > 0 || rows.length > 0 || script.after.length > 0;
  const isEndNode = type === "end";
  const isInitialNode = type === "initial";
  const isSelectedNode = selectedNodeId === id;
  const active = hovering || Boolean(selected);

  // An end node with nothing but the end is a small pill, like a start flag
  if (isCompactEnd(type, data)) {
    return (
      <div
        className={`relative flex items-center gap-2 rounded-lg border bg-card px-3 text-[13px] font-semibold ${
          selected ? "border-brand ring-1 ring-brand" : "border-accent-line"
        }`}
        style={{ width: COMPACT_END.width, height: COMPACT_END.height }}
      >
        <Handle
          type="target"
          id={IN_HANDLE}
          position={Position.Top}
          className="bg-accent-line! h-2.5! w-2.5!"
        />
        <LogOut className="h-[13px] w-[13px] shrink-0 text-muted-foreground" />
        <InlineText
          value={data.label || id}
          editing={editing?.kind === "node"}
          onStartEdit={() => setEditing({ kind: "node" })}
          onCommit={(name) => {
            setEditing(null);
            actions?.renameNode(id, name);
          }}
          onCancel={() => setEditing(null)}
          className="flex-1 text-nowrap"
          ariaLabel="Node name"
          maxChars={NAME_LIMITS.node}
        />
      </div>
    );
  }

  return (
    <div
      className={`relative rounded-lg border bg-card text-xs ${
        selected ? "border-brand ring-1 ring-brand" : "border-accent-line"
      }`}
      style={{ width: NODE_CARD.width }}
      onMouseOver={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <Handle
        type="target"
        id={IN_HANDLE}
        position={Position.Top}
        className="bg-accent-line! h-2.5! w-2.5!"
      />
      <div
        className={`flex items-center gap-1.5 px-2.5 text-[13px] font-semibold ${
          hasBelowHeader && !description ? "border-b" : ""
        }`}
        style={{ height: NODE_CARD.headerHeight }}
      >
        {isInitialNode && <Play className="h-[13px] w-[13px] text-muted-foreground shrink-0" />}
        {isEndNode && <LogOut className="h-[13px] w-[13px] text-muted-foreground shrink-0" />}
        <InlineText
          value={data.label || id}
          editing={editing?.kind === "node"}
          onStartEdit={() => setEditing({ kind: "node" })}
          onCommit={(name) => {
            setEditing(null);
            actions?.renameNode(id, name);
          }}
          onCancel={() => setEditing(null)}
          className="flex-1 text-nowrap"
          ariaLabel="Node name"
          maxChars={NAME_LIMITS.node}
        />
      </div>

      {/* What the node does: its first task message, two lines at most. */}
      {description && (
        <div
          className={`px-2.5 pb-2 text-[11px] leading-4 text-muted-foreground ${
            hasBelowHeader ? "border-b" : ""
          }`}
          style={{ height: NODE_CARD.descriptionHeight }}
          title={description}
        >
          <p className="line-clamp-2">{description}</p>
        </div>
      )}

      {/* On entry: above the functions. */}
      {script.before.length > 0 && (
        <ActionLines
          nodeId={id}
          lines={script.before}
          className={rows.length > 0 || script.after.length > 0 ? "border-b" : ""}
        />
      )}

      {rows.length > 0 && (
        <div className={`py-1 ${script.after.length > 0 ? "border-b" : ""}`}>
          {rows.map(({ fn, functionIndex, missing }) => (
            <FunctionRow
              key={functionIndex}
              nodeId={id}
              fn={fn}
              functionIndex={functionIndex}
              missing={missing}
              editing={editing?.kind === "function" && editing.functionIndex === functionIndex}
              setEditing={setEditing}
              selected={isSelectedNode && selectedFunctionIndex === functionIndex}
            />
          ))}
        </div>
      )}

      {/* On exit: below the functions. */}
      {script.after.length > 0 && <ActionLines nodeId={id} lines={script.after} />}

      {!isEndNode && (
        <Handle
          type="source"
          id={OUT_HANDLE}
          position={Position.Bottom}
          className="bg-accent-line! h-2.5! w-2.5! hover:bg-brand! hover:scale-125 transition-transform"
          title="Drag to a node to add a function leading there"
        />
      )}
      {!isEndNode && actions && (
        // An invisible strip under the card so the "+" appears before the
        // pointer reaches it, and the trip down to it stays inside the node.
        <div
          aria-hidden
          className="nodrag nopan absolute inset-x-0 top-full h-14"
          onClick={(e) => e.stopPropagation()}
        />
      )}
      {!isEndNode && actions && (
        <NodeAddToolbar
          visible={active}
          onAdd={(kind) => {
            const functionIndex = actions.addDestination(id, kind);
            if (kind === "stay" && functionIndex !== null) {
              setEditing({ kind: "function", functionIndex });
            }
          }}
          title="Add a function"
        />
      )}
    </div>
  );
}

const ACTION_ICONS = { says: Volume2, handler: Zap, custom: Plug, more: Plus };

/**
 * The node's actions as a short script under its name: what it says, in
 * quotes, and what it runs, so what happens on entry and exit is visible
 * without opening the node. A click opens the inspector's Actions tab.
 */
function ActionLines({
  nodeId,
  lines,
  className,
}: {
  nodeId: string;
  lines: ActionLine[];
  className?: string;
}) {
  const selectNode = useEditorStore((state) => state.selectNode);
  const requestInspectorTab = useEditorStore((state) => state.requestInspectorTab);
  const setSidebarCollapsed = useEditorStore((state) => state.setSidebarCollapsed);
  const open = () => {
    setSidebarCollapsed(false);
    requestInspectorTab("actions");
    selectNode(nodeId);
  };
  return (
    <div className={`py-1 ${className ?? ""}`}>
      {lines.map((line, i) => {
        const Icon = ACTION_ICONS[line.kind];
        return (
          <button
            key={i}
            type="button"
            className="nodrag flex w-full min-w-0 items-center gap-1.5 px-2.5 text-left text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            style={{ height: NODE_CARD.rowHeight }}
            title={line.title}
            onClick={open}
          >
            <Icon className="h-[13px] w-[13px] shrink-0" />
            <span className={`truncate ${line.kind === "says" ? "italic" : "font-mono"}`}>
              {line.text}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * One function that stays on the node, or one whose destination is gone:
 * its name, and for the latter the missing node's name with a warning.
 */
function FunctionRow({
  nodeId,
  fn,
  functionIndex,
  missing,
  editing,
  setEditing,
  selected,
}: {
  nodeId: string;
  fn: FlowConfigFunction;
  functionIndex: number;
  /** The destination that no longer exists, or null for a function that stays. */
  missing: string | null;
  editing: boolean;
  setEditing: (editing: Editing) => void;
  selected: boolean;
}) {
  const actions = useCanvasActions();
  const iconClass = "h-[13px] w-[13px] shrink-0 text-muted-foreground";
  return (
    <div
      className={`group relative flex items-center gap-1.5 pl-2.5 pr-2 ${
        selected ? "bg-brand/10" : ""
      }`}
      style={{ height: NODE_CARD.rowHeight }}
      title={
        missing
          ? `No node named "${missing}"; route this function again`
          : "Stays on this node; drag from the exit to a node to route it there"
      }
    >
      <button
        type="button"
        className={`flex min-w-0 flex-1 items-center gap-1.5 text-left ${
          missing ? "text-orange-600 dark:text-orange-400" : ""
        }`}
        onClick={() => actions?.selectRow(nodeId, functionIndex, null)}
      >
        {missing ? <ArrowRight className={iconClass} /> : <Wrench className={iconClass} />}
        <InlineText
          value={fn.name}
          placeholder={`function ${functionIndex + 1}`}
          editing={editing}
          onStartEdit={() => setEditing({ kind: "function", functionIndex })}
          onCommit={(name) => {
            setEditing(null);
            actions?.renameFunction(nodeId, functionIndex, name);
          }}
          onCancel={() => setEditing(null)}
          className={`font-mono ${fn.name ? "" : "italic text-muted-foreground"}`}
          ariaLabel="Tool name"
          maxChars={NAME_LIMITS.tool}
        />
        {missing && (
          <>
            <span className="truncate font-mono text-muted-foreground">{missing}</span>
            <AlertTriangle className="h-[13px] w-[13px] shrink-0" />
          </>
        )}
      </button>
      {actions && (
        <button
          type="button"
          className="nodrag nopan shrink-0 p-0.5 text-muted-foreground opacity-0 hover:text-red-600 group-hover:opacity-100"
          title="Remove this function"
          aria-label="Remove this function"
          onClick={(e) => {
            e.stopPropagation();
            actions.removeFunction(nodeId, functionIndex);
          }}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
