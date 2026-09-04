"use client";

import { Handle, type NodeProps, Position, useNodes, useUpdateNodeInternals } from "@xyflow/react";
import { AlertTriangle, ArrowRight, LogOut, Play, Plus, Split, Wrench, X } from "lucide-react";
import { useEffect, useState } from "react";

import { useHoverWithGrace } from "@/hooks/useHoverWithGrace";
import { type ConfigCanvasNode, handleId, NEW_FUNCTION_HANDLE } from "@/lib/convert/configToCanvas";
import { NODE_CARD } from "@/lib/layout/autoLayout";
import { type FlowConfigFunction, isBranch } from "@/lib/schema/flowConfig";
import { useEditorStore } from "@/lib/store/editorStore";

import { useCanvasActions } from "./canvasActions";
import InlineText from "./InlineText";
import NodeAddToolbar from "./NodeAddToolbar";

/**
 * How many characters of each name the card shows before an ellipsis. The
 * full text is in the tooltip and when editing. These are independent of the
 * card's width, which is NODE_CARD.width in lib/layout/autoLayout.ts.
 */
const NAME_LIMITS = { node: 35, tool: 25, caseValue: 25, field: 10 };

/** Which text on the card is being edited in place. */
type Editing =
  | { kind: "node" }
  | { kind: "function"; functionIndex: number }
  | { kind: "field"; functionIndex: number }
  | { kind: "case"; functionIndex: number; caseValue: string }
  | null;

/**
 * A node card: the node's name, then one row per function it offers. A
 * function that leads somewhere has a port on its row; a branch function
 * lists its cases and default as sub-rows, each with a port. The rows are
 * the edge labels. Names rename in place on double-click, rows remove on
 * hover, and a "+ function" row adds a function that stays on the node.
 */
export default function BaseNode({ id, data, selected, type }: NodeProps<ConfigCanvasNode>) {
  const allNodes = useNodes();
  const actions = useCanvasActions();
  const [hovering, setHovering] = useHoverWithGrace();
  const [editing, setEditing] = useState<Editing>(null);
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);
  const selectedFunctionIndex = useEditorStore((state) => state.selectedFunctionIndex);
  const selectedConditionIndex = useEditorStore((state) => state.selectedConditionIndex);

  const nodeTypes = new Map(allNodes.map((n) => [n.id, n.type]));
  const functions = data.functions ?? [];

  // React Flow measures handles when the card mounts or resizes. Renaming a
  // case, or removing a row above another, changes handle ids without a
  // resize, so ask for a re-measure whenever the set of handle ids changes.
  const updateNodeInternals = useUpdateNodeInternals();
  const handleKey = functions
    .map((fn, i) =>
      isBranch(fn.transition_to)
        ? `${i}:${Object.keys(fn.transition_to.cases).join(",")}:${fn.transition_to.default ?? ""}`
        : `${i}`
    )
    .join("|");
  useEffect(() => {
    updateNodeInternals(id);
  }, [id, handleKey, updateNodeInternals]);
  const isEndNode = type === "end";
  const isInitialNode = type === "initial";
  const isSelectedNode = selectedNodeId === id;
  const active = hovering || Boolean(selected);

  return (
    <div
      className={`relative rounded-lg border-2 bg-white text-xs shadow-sm dark:bg-neutral-800 ${
        selected ? "border-blue-500" : "border-neutral-300 dark:border-neutral-600"
      }`}
      style={{ width: NODE_CARD.width }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="bg-neutral-400! h-2.5! w-2.5!"
        style={{ top: NODE_CARD.headerHeight / 2 }}
      />
      <div
        className={`flex items-center gap-1.5 px-2.5 text-[13px] font-semibold ${
          functions.length > 0 ? "border-b border-neutral-200 dark:border-neutral-700" : ""
        }`}
        style={{ height: NODE_CARD.headerHeight }}
      >
        {isInitialNode && (
          <Play className="h-[13px] w-[13px] text-neutral-400 dark:text-neutral-500 shrink-0" />
        )}
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
        {isEndNode && (
          <LogOut className="h-[13px] w-[13px] text-neutral-400 dark:text-neutral-500" />
        )}
      </div>

      {functions.length > 0 && (
        <div className="py-1">
          {functions.map((fn, functionIndex) => (
            <FunctionRows
              key={functionIndex}
              nodeId={id}
              fn={fn}
              functionIndex={functionIndex}
              nodeTypes={nodeTypes}
              active={active}
              editing={editing}
              setEditing={setEditing}
              selectedCase={
                isSelectedNode && selectedFunctionIndex === functionIndex
                  ? (selectedConditionIndex ?? "function")
                  : null
              }
            />
          ))}
        </div>
      )}

      {!isEndNode && (
        <Handle
          type="source"
          id={NEW_FUNCTION_HANDLE}
          position={Position.Bottom}
          className="bg-neutral-400!"
          title="Drag to a node to add a function leading there"
        />
      )}
      {!isEndNode && actions && (
        // An invisible strip under the card so the "+" appears before the
        // pointer reaches it, and the trip down to it stays inside the node.
        <div
          aria-hidden
          className="nodrag nopan absolute inset-x-0 top-full h-12"
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
          onHoverChange={setHovering}
        />
      )}
    </div>
  );
}

const ROW_CLASS = "group relative flex items-center gap-1.5 pr-4";
const SELECTED_ROW_CLASS = "bg-blue-50 dark:bg-blue-950/40";
const MISSING_CLASS = "text-orange-600 dark:text-orange-400";

function FunctionRows({
  nodeId,
  fn,
  functionIndex,
  nodeTypes,
  active,
  editing,
  setEditing,
  selectedCase,
}: {
  nodeId: string;
  fn: FlowConfigFunction;
  functionIndex: number;
  /** Every node on the canvas and its type, to draw a destination kind and spot a missing one. */
  nodeTypes: Map<string, string | undefined>;
  active: boolean;
  editing: Editing;
  setEditing: (editing: Editing) => void;
  /** "function" for the function row itself, a case index, -1 for the default, or null. */
  selectedCase: "function" | number | null;
}) {
  const actions = useCanvasActions();
  const select = (caseIndex: number | null) => actions?.selectRow(nodeId, functionIndex, caseIndex);
  const transition = fn.transition_to;
  const editingName = editing?.kind === "function" && editing.functionIndex === functionIndex;

  const nameText = (
    <InlineText
      value={fn.name}
      placeholder={`function ${functionIndex + 1}`}
      editing={editingName}
      onStartEdit={() => setEditing({ kind: "function", functionIndex })}
      onCommit={(name) => {
        setEditing(null);
        actions?.renameFunction(nodeId, functionIndex, name);
      }}
      onCancel={() => setEditing(null)}
      className={`font-mono ${fn.name ? "" : "italic text-neutral-400"}`}
      ariaLabel="Tool name"
      maxChars={NAME_LIMITS.tool}
    />
  );
  const removeFunction = actions ? () => actions.removeFunction(nodeId, functionIndex) : undefined;

  if (isBranch(transition)) {
    const cases = Object.entries(transition.cases);
    return (
      // The branch as a group: a tinted band behind the function and its
      // cases, and a guide line down from the fork icon past the case rows.
      <div className="relative bg-purple-500/5 dark:bg-purple-400/5">
        <span
          aria-hidden
          className="absolute w-px bg-purple-300 dark:bg-purple-700"
          style={{
            left: 15,
            top: NODE_CARD.rowHeight,
            bottom: NODE_CARD.rowHeight / 2,
          }}
        />
        <Row
          label={nameText}
          icon={
            <Split className="h-[13px] w-[13px] shrink-0 text-purple-600 dark:text-purple-400" />
          }
          selected={selectedCase === "function"}
          onClick={() => select(null)}
          onRemove={removeFunction}
          removeTitle="Remove this function and its branch"
          trailing={
            <span
              className="flex max-w-[45%] shrink-0 items-center gap-1 text-neutral-500"
              title="The field of the tool result the branch keys on"
            >
              <ArrowRight className="h-[13px] w-[13px] shrink-0" />
              <InlineText
                value={transition.field}
                placeholder="field"
                editing={editing?.kind === "field" && editing.functionIndex === functionIndex}
                onStartEdit={() => setEditing({ kind: "field", functionIndex })}
                onCommit={(field) => {
                  setEditing(null);
                  actions?.setBranchField(nodeId, functionIndex, field.trim());
                }}
                onCancel={() => setEditing(null)}
                className={`font-mono ${transition.field ? "" : "italic text-neutral-400"}`}
                ariaLabel="Branch field"
                maxChars={NAME_LIMITS.field}
              />
            </span>
          }
        />
        {cases.map(([value, target], caseIndex) => (
          <Row
            key={value}
            handle={handleId({ kind: "case", functionIndex, caseValue: value })}
            label={
              <InlineText
                value={value}
                editing={
                  editing?.kind === "case" &&
                  editing.functionIndex === functionIndex &&
                  editing.caseValue === value
                }
                onStartEdit={() => setEditing({ kind: "case", functionIndex, caseValue: value })}
                onCommit={(next) => {
                  setEditing(null);
                  actions?.renameBranchCase(nodeId, functionIndex, value, next.trim());
                }}
                onCancel={() => setEditing(null)}
                ariaLabel="Case value"
                maxChars={NAME_LIMITS.caseValue}
              />
            }
            indent
            missing={!nodeTypes.has(target)}
            selected={selectedCase === caseIndex}
            onClick={() => select(caseIndex)}
            onRemove={
              actions && cases.length > 1
                ? () => actions.removeBranchCase(nodeId, functionIndex, caseIndex)
                : undefined
            }
            removeTitle="Remove this case"
          />
        ))}
        {transition.default && (
          <Row
            handle={handleId({ kind: "default", functionIndex })}
            label={<span className="italic">default</span>}
            indent
            muted
            missing={!nodeTypes.has(transition.default)}
            selected={selectedCase === -1}
            onClick={() => select(-1)}
            onRemove={
              actions ? () => actions.removeBranchCase(nodeId, functionIndex, -1) : undefined
            }
            removeTitle="Remove the default"
          />
        )}
        <Row
          handle={handleId({ kind: "new-case", functionIndex })}
          label={<span>add case</span>}
          indent
          muted
          icon={<Plus className="h-3 w-3" />}
          onClick={() => actions?.addBranchCase(nodeId, functionIndex)}
          title="Add a case leading to a new node, or drag to a node"
        />
      </div>
    );
  }

  const target = typeof transition === "string" ? transition : null;
  const iconClass = "h-[13px] w-[13px] shrink-0 text-neutral-400";
  const icon =
    target === null ? (
      <Wrench className={iconClass} />
    ) : nodeTypes.get(target) === "end" ? (
      <LogOut className={iconClass} />
    ) : (
      <ArrowRight className={iconClass} />
    );
  return (
    <Row
      handle={handleId({ kind: "function", functionIndex })}
      label={nameText}
      icon={icon}
      missing={target !== null && !nodeTypes.has(target)}
      selected={selectedCase === "function"}
      onClick={() => select(null)}
      onRemove={removeFunction}
      removeTitle="Remove this function"
      title={target === null ? "Stays on this node; drag to a node to route there" : undefined}
    />
  );
}

function Row({
  handle,
  label,
  indent,
  muted,
  missing,
  selected,
  icon,
  trailing,
  onClick,
  onRemove,
  removeTitle,
  title,
}: {
  handle?: string;
  label: React.ReactNode;
  indent?: boolean;
  muted?: boolean;
  missing?: boolean;
  selected?: boolean;
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
  onClick: () => void;
  onRemove?: () => void;
  removeTitle?: string;
  title?: string;
}) {
  return (
    <div
      className={`${ROW_CLASS} ${indent ? "pl-7" : "pl-2.5"} ${selected ? SELECTED_ROW_CLASS : ""} ${
        muted ? "text-neutral-500" : ""
      }`}
      style={{ height: NODE_CARD.rowHeight }}
      title={title}
    >
      <button
        type="button"
        className={`flex flex-1 min-w-0 items-center gap-1.5 text-left ${missing ? MISSING_CLASS : ""}`}
        onClick={onClick}
      >
        {icon}
        {label}
        {missing && <AlertTriangle className="h-[13px] w-[13px] shrink-0" />}
      </button>
      {trailing}
      {onRemove ? (
        <button
          type="button"
          className="nodrag nopan shrink-0 rounded p-0.5 text-neutral-400 opacity-0 hover:text-red-600 group-hover:opacity-100"
          title={removeTitle}
          aria-label={removeTitle}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <X className="h-3 w-3" />
        </button>
      ) : (
        <span aria-hidden className="h-4 w-4 shrink-0" />
      )}
      {handle && (
        <Handle
          type="source"
          id={handle}
          position={Position.Right}
          className="bg-neutral-400! h-2.5! w-2.5! hover:bg-blue-500! hover:scale-125 transition-transform"
          style={{ top: "50%" }}
        />
      )}
    </div>
  );
}
