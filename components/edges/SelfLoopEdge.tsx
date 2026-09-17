"use client";

import { BaseEdge, type EdgeProps, useInternalNode, useReactFlow } from "@xyflow/react";

import {
  ARROW_MARKER,
  ARROW_MARKER_SELECTED,
  type CanvasEdge,
  nodeFunctions,
} from "@/lib/convert/configToCanvas";

import { loopClearance } from "@/lib/layout/autoLayout";

import { useCanvasActions } from "../nodes/canvasActions";
import { loopPath, nodeBox } from "./edgeGeometry";
import EdgeLabel from "./EdgeLabel";

/**
 * An edge from a card back into itself: out of the bottom edge near the
 * right corner, up the card's right side, and into the top edge there.
 * Several loops on one card step outward so they stay apart, and the label
 * sits on the run up the side, far enough out to clear the card.
 */
export default function SelfLoopEdge({
  id,
  source,
  label,
  data,
  selected,
  style = {},
}: EdgeProps<CanvasEdge>) {
  const actions = useCanvasActions();
  const { setEdges, setNodes } = useReactFlow();
  const sourceNode = useInternalNode(source);

  // Which of this node's self-loops this is, in function order
  const loopIndexes = nodeFunctions(sourceNode as Parameters<typeof nodeFunctions>[0]).flatMap(
    (fn, functionIndex) => (fn.transition_to === source ? [functionIndex] : [])
  );
  const loopIndex = Math.max(0, loopIndexes.indexOf(data?.functionIndex ?? -1));
  const text = typeof label === "string" ? label : "";
  const { path, labelX, labelY } = loopPath(nodeBox(sourceNode), loopClearance(text), loopIndex);

  const select = () => {
    setNodes((nds) => nds.map((node) => ({ ...node, selected: false })));
    setEdges((edges) => edges.map((edge) => ({ ...edge, selected: edge.id === id })));
    if (data) actions?.selectRow(data.sourceNodeId, data.functionIndex, null);
  };

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={selected ? ARROW_MARKER_SELECTED : ARROW_MARKER}
        style={{ ...style, strokeWidth: selected ? 1.5 : 1 }}
      />
      <EdgeLabel
        text={text}
        kind="transition"
        x={labelX}
        y={labelY}
        selected={selected}
        onClick={select}
      />
    </>
  );
}
