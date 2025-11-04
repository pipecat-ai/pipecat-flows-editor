"use client";

import { Handle, Position, useNodes, type NodeProps } from "reactflow";
import { AlertTriangle, LogOut, Play } from "lucide-react";
import { deriveNodeType } from "@/lib/utils/nodeType";

export default function BaseNode({ data, selected }: NodeProps) {
  const allNodes = useNodes();

  // Compute broken references from node state directly
  // React Compiler will automatically memoize this computation
  const nodeIds = new Set(allNodes.map((n) => n.id));
  const functions = (data?.functions as any[] | undefined) ?? [];
  const hasBrokenReferences = functions.some(
    (func) => func.next_node_id && !nodeIds.has(func.next_node_id)
  );

  // Check if this is an end node (has post_actions with end_conversation)
  const postActions = (data?.post_actions as any[] | undefined) ?? [];
  const isEndNode = postActions.some((action) => action.type === "end_conversation");

  // Check if this is an initial node (has role_messages)
  const nodeType = deriveNodeType(data, undefined);
  const isInitialNode = nodeType === "initial";

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
        <div className="text-xs font-normal flex-1">{data.label || "Node"}</div>
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
