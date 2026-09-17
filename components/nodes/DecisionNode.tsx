"use client";

import { Handle, type NodeProps, Position } from "@xyflow/react";
import { useState } from "react";

import { type DecisionCanvasNode, IN_HANDLE, OUT_HANDLE } from "@/lib/convert/configToCanvas";
import { DECISION } from "@/lib/layout/autoLayout";

import { NAME_LIMITS } from "./BaseNode";
import { useCanvasActions } from "./canvasActions";
import InlineText from "./InlineText";

/**
 * A branch table as a decision point: a flat diamond with the field it
 * keys on inside. The function that leads here is the label on the edge
 * in; the cases are the labels on the edges out, which leave by the side
 * facing their target. Without a default, an unmatched value stays on the
 * source node, which a dashed outline says. The field renames in place;
 * selecting the diamond selects its function.
 */
export default function DecisionNode({ data, selected }: NodeProps<DecisionCanvasNode>) {
  const actions = useCanvasActions();
  const [editing, setEditing] = useState(false);
  const { width, height } = DECISION;
  const inset = 0.75;
  const points = [
    [width / 2, inset],
    [width - inset, height / 2],
    [width / 2, height - inset],
    [inset, height / 2],
  ]
    .map(([x, y]) => `${x},${y}`)
    .join(" ");
  const handleClass =
    "bg-accent-line! h-2.5! w-2.5! hover:bg-brand! hover:scale-125 transition-transform";
  const title = `${data.functionName || "A function"} branches on ${data.field || "a field"} of its result${
    data.hasDefault ? "" : "; a value that matches no case stays on the node"
  }`;

  return (
    <div className="relative" style={{ width, height }} title={title}>
      <Handle type="target" id={IN_HANDLE} position={Position.Top} className={handleClass} />
      <svg width={width} height={height} className="absolute inset-0" aria-hidden>
        <polygon
          points={points}
          className={`fill-card ${selected ? "stroke-brand" : "stroke-accent-line"}`}
          strokeWidth={selected ? 1.5 : 1}
          strokeDasharray={data.hasDefault ? undefined : "4 3"}
          strokeLinejoin="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center px-6 text-[11px] leading-none">
        <InlineText
          value={data.field}
          placeholder="field"
          editing={editing}
          onStartEdit={() => setEditing(true)}
          onCommit={(field) => {
            setEditing(false);
            actions?.setBranchField(data.sourceNodeId, data.functionIndex, field.trim());
          }}
          onCancel={() => setEditing(false)}
          className={`text-center font-mono ${data.field ? "text-foreground" : "italic text-muted-foreground"}`}
          ariaLabel="Branch field"
          maxChars={NAME_LIMITS.field}
        />
      </div>
      <Handle
        type="source"
        id={`${OUT_HANDLE}-left`}
        position={Position.Left}
        className={handleClass}
      />
      <Handle
        type="source"
        id={`${OUT_HANDLE}-right`}
        position={Position.Right}
        className={handleClass}
      />
      <Handle
        type="source"
        id={OUT_HANDLE}
        position={Position.Bottom}
        className={handleClass}
        title="Drag to a node to add a case leading there"
      />
    </div>
  );
}
