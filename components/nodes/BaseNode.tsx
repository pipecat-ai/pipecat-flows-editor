"use client";

import { Handle, type NodeProps, Position, useNodes } from "@xyflow/react";
import { AlertTriangle, LogOut, Play } from "lucide-react";

import type { ConfigCanvasNode } from "@/lib/convert/configToCanvas";
import { functionTargets } from "@/lib/schema/flowConfig";

export default function BaseNode({ data, selected, type }: NodeProps<ConfigCanvasNode>) {
  const allNodes = useNodes();

  // A destination that names no node on the canvas
  const nodeIds = new Set(allNodes.map((n) => n.id));
  const hasBrokenReferences = (data.functions ?? []).some((fn) =>
    functionTargets(fn).some((target) => !nodeIds.has(target))
  );

  const isEndNode = type === "end";
  const isInitialNode = type === "initial";

  return (
    <div
      className={`rounded-lg border-2 bg-white px-2 py-1.5 shadow-sm dark:bg-neutral-800 ${
        selected ? "border-blue-500" : "border-neutral-300 dark:border-neutral-600"
      } ${hasBrokenReferences ? "border-orange-400 dark:border-orange-500" : ""}`}
    >
      <Handle type="target" position={Position.Top} className="bg-neutral-400!" />
      <div className="flex items-center gap-1.5">
        {isInitialNode && (
          <Play className="h-3 w-3 text-neutral-400 dark:text-neutral-500 shrink-0" />
        )}
        <div className="text-xs font-normal flex-1 text-nowrap">{data.label || "Node"}</div>
        {hasBrokenReferences && (
          <div title="This node has broken references (functions pointing to deleted nodes)">
            <AlertTriangle className="h-3 w-3 text-orange-500 dark:text-orange-400 shrink-0" />
          </div>
        )}
        {isEndNode && <LogOut className="h-3 w-3 text-neutral-400 dark:text-neutral-500" />}
      </div>
      {!isEndNode && (
        <Handle type="source" position={Position.Bottom} className="bg-neutral-400!" />
      )}
    </div>
  );
}
