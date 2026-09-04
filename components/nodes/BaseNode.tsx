"use client";

import { Handle, type NodeProps, Position, useNodes } from "@xyflow/react";
import { AlertTriangle, GitBranch, LogOut, Play, Plus } from "lucide-react";

import { useHoverWithGrace } from "@/hooks/useHoverWithGrace";
import { type ConfigCanvasNode, handleId, NEW_FUNCTION_HANDLE } from "@/lib/convert/configToCanvas";
import { NODE_CARD } from "@/lib/layout/autoLayout";
import { type FlowConfigFunction, isBranch } from "@/lib/schema/flowConfig";
import { useEditorStore } from "@/lib/store/editorStore";

import { useCanvasActions } from "./canvasActions";
import NodeAddToolbar, { DestinationMenu } from "./NodeAddToolbar";

/**
 * A node card: the node's name, then one row per function it offers. A
 * function that leads somewhere has a port on its row; a branch function
 * lists its cases and default as sub-rows, each with a port. The rows are
 * the edge labels.
 */
export default function BaseNode({ id, data, selected, type }: NodeProps<ConfigCanvasNode>) {
  const allNodes = useNodes();
  const actions = useCanvasActions();
  const [hovering, setHovering] = useHoverWithGrace();
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);
  const selectedFunctionIndex = useEditorStore((state) => state.selectedFunctionIndex);
  const selectedConditionIndex = useEditorStore((state) => state.selectedConditionIndex);

  const nodeIds = new Set(allNodes.map((n) => n.id));
  const functions = data.functions ?? [];
  const isEndNode = type === "end";
  const isInitialNode = type === "initial";
  const isSelectedNode = selectedNodeId === id;

  return (
    <div
      className={`rounded-lg border-2 bg-white text-xs shadow-sm dark:bg-neutral-800 ${
        selected ? "border-blue-500" : "border-neutral-300 dark:border-neutral-600"
      }`}
      style={{ minWidth: NODE_CARD.minWidth }}
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
        className={`flex items-center gap-1.5 px-2.5 font-medium ${
          functions.length > 0 ? "border-b border-neutral-200 dark:border-neutral-700" : ""
        }`}
        style={{ height: NODE_CARD.headerHeight }}
      >
        {isInitialNode && (
          <Play className="h-3 w-3 text-neutral-400 dark:text-neutral-500 shrink-0" />
        )}
        <div className="flex-1 text-nowrap">{data.label || "Node"}</div>
        {isEndNode && <LogOut className="h-3 w-3 text-neutral-400 dark:text-neutral-500" />}
      </div>

      {functions.length > 0 && (
        <div className="py-1">
          {functions.map((fn, functionIndex) => (
            <FunctionRows
              key={`${functionIndex}:${fn.name}`}
              nodeId={id}
              fn={fn}
              functionIndex={functionIndex}
              nodeIds={nodeIds}
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
        <NodeAddToolbar
          visible={hovering || Boolean(selected)}
          onAdd={(kind) => actions.addDestination(id, kind)}
          title="Add a function leading to a new node"
          onHoverChange={setHovering}
        />
      )}
    </div>
  );
}

const ROW_CLASS = "relative flex items-center gap-1.5 pr-4";
const SELECTED_ROW_CLASS = "bg-blue-50 dark:bg-blue-950/40";
const MISSING_CLASS = "text-orange-600 dark:text-orange-400";

function FunctionRows({
  nodeId,
  fn,
  functionIndex,
  nodeIds,
  selectedCase,
}: {
  nodeId: string;
  fn: FlowConfigFunction;
  functionIndex: number;
  nodeIds: Set<string>;
  /** "function" for the function row itself, a case index, -1 for the default, or null. */
  selectedCase: "function" | number | null;
}) {
  const actions = useCanvasActions();
  const select = (caseIndex: number | null) => actions?.selectRow(nodeId, functionIndex, caseIndex);
  const name = fn.name || `function ${functionIndex + 1}`;
  const transition = fn.transition_to;
  const rowStyle = { height: NODE_CARD.rowHeight };

  if (isBranch(transition)) {
    const cases = Object.entries(transition.cases);
    return (
      <>
        <button
          type="button"
          className={`${ROW_CLASS} w-full px-2.5 text-left ${selectedCase === "function" ? SELECTED_ROW_CLASS : ""}`}
          style={rowStyle}
          onClick={() => select(null)}
        >
          <GitBranch className="h-3 w-3 shrink-0 text-purple-600 dark:text-purple-400" />
          <span className="flex-1 truncate font-mono">{name}</span>
          <span className="truncate text-neutral-500">
            → <span className="font-mono">{transition.field || "…"}</span>
          </span>
        </button>
        {cases.map(([value, target], caseIndex) => (
          <Row
            key={value}
            handle={handleId({ kind: "case", functionName: fn.name, caseValue: value })}
            label={value}
            indent
            missing={!nodeIds.has(target)}
            selected={selectedCase === caseIndex}
            onClick={() => select(caseIndex)}
          />
        ))}
        {transition.default && (
          <Row
            handle={handleId({ kind: "default", functionName: fn.name })}
            label="default"
            indent
            muted
            missing={!nodeIds.has(transition.default)}
            selected={selectedCase === -1}
            onClick={() => select(-1)}
          />
        )}
        <Row
          handle={handleId({ kind: "new-case", functionName: fn.name })}
          label="add case"
          indent
          muted
          icon={<Plus className="h-3 w-3" />}
          onClick={() => actions?.addBranchCase(nodeId, functionIndex)}
          title="Add a case leading to a new node, or drag to a node"
        />
      </>
    );
  }

  const target = typeof transition === "string" ? transition : null;
  const row = (
    <Row
      handle={handleId({ kind: "function", functionName: fn.name })}
      label={name}
      mono
      missing={target !== null && !nodeIds.has(target)}
      selected={selectedCase === "function"}
      onClick={() => select(null)}
      trailing={
        target === null && actions ? (
          <DestinationMenu
            onAdd={(kind) => actions.addFunctionDestination(nodeId, functionIndex, kind)}
            trigger={
              <button
                type="button"
                className="nodrag nopan rounded p-0.5 text-neutral-400 hover:text-blue-600"
                title="Add a destination"
                aria-label={`Add a destination for ${name}`}
                onClick={(e) => e.stopPropagation()}
              >
                <Plus className="h-3 w-3" />
              </button>
            }
          />
        ) : null
      }
      title={target === null ? "Stays on this node; drag to a node to route there" : undefined}
    />
  );
  return row;
}

function Row({
  handle,
  label,
  indent,
  mono,
  muted,
  missing,
  selected,
  icon,
  trailing,
  onClick,
  title,
}: {
  handle: string;
  label: string;
  indent?: boolean;
  mono?: boolean;
  muted?: boolean;
  missing?: boolean;
  selected?: boolean;
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
  onClick: () => void;
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
        className={`flex flex-1 min-w-0 items-center gap-1.5 text-left ${mono ? "font-mono" : ""} ${
          missing ? MISSING_CLASS : ""
        }`}
        onClick={onClick}
      >
        {icon}
        <span className="truncate">{label}</span>
        {missing && <AlertTriangle className="h-3 w-3 shrink-0" />}
      </button>
      {trailing}
      <Handle
        type="source"
        id={handle}
        position={Position.Right}
        className="bg-neutral-400! h-2.5! w-2.5! hover:bg-blue-500! hover:scale-125 transition-transform"
        style={{ top: "50%" }}
      />
    </div>
  );
}
