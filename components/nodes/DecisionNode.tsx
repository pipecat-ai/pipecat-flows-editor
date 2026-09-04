"use client";

import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import { GitBranch } from "lucide-react";

import { useHoverWithGrace } from "@/hooks/useHoverWithGrace";
import type { BranchCanvasNode } from "@/lib/convert/configToCanvas";

import { useCanvasActions } from "./canvasActions";
import NodeAddToolbar from "./NodeAddToolbar";

/** A function's branch table: one edge out per case, plus one for the default. */
export default function DecisionNode({ id, data, selected }: NodeProps<BranchCanvasNode>) {
  const actions = useCanvasActions();
  const [hovering, setHovering] = useHoverWithGrace();

  return (
    <div
      className={`rounded-xs border-2 px-3 py-2 max-w-[180px] bg-linear-to-br from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30 border-purple-300 dark:border-purple-600 shadow-sm ${
        selected ? "border-purple-500 dark:border-purple-400 shadow-md" : ""
      }`}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <Handle
        isConnectable={false}
        type="target"
        position={Position.Top}
        className="bg-purple-400! rounded-b-none! border-none!"
      />
      <div className="flex items-center gap-1.5 mb-1">
        <GitBranch className="h-3 w-3 text-purple-600 dark:text-purple-400 shrink-0" />
        <div className="text-xs font-semibold text-purple-900 dark:text-purple-100">
          {data.label}
        </div>
      </div>
      <div className="text-[9px] text-purple-600 dark:text-purple-400 opacity-70">
        on <span className="font-mono">{data.field || "…"}</span>: {data.caseCount} case
        {data.caseCount !== 1 ? "s" : ""}
        {data.hasDefault ? " + default" : ""}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="bg-purple-400! rounded-t-none! border-none!"
      />
      {actions && (
        <NodeAddToolbar
          visible={hovering || Boolean(selected)}
          onAdd={() => actions.addBranchCase(id)}
          single
          title="Add a case leading to a new node"
          onHoverChange={setHovering}
        />
      )}
    </div>
  );
}
