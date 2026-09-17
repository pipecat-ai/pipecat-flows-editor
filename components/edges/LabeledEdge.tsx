"use client";

import {
  BaseEdge,
  type EdgeProps,
  getBezierPath,
  Position,
  useEdges,
  useInternalNode,
  useNodes,
  useReactFlow,
} from "@xyflow/react";

import {
  ARROW_MARKER,
  ARROW_MARKER_SELECTED,
  type CanvasEdge,
  type FlowCanvasNode,
} from "@/lib/convert/configToCanvas";

import { useCanvasActions } from "../nodes/canvasActions";
import { loopPath, nodeBox } from "./edgeGeometry";
import EdgeLabel from "./EdgeLabel";

/** How far apart the labels of edges between the same two nodes are stacked. */
const STEP = 18;
/** Beyond this, a case leaves its decision node by the side rather than the bottom. */
const SIDE_MARGIN = 24;

/**
 * An edge with its function name or case value on it. A curve from the
 * source's bottom edge to the target's top, with the label at its midpoint,
 * where curves that leave one card spread apart on their own. A card's
 * edges leave from points spread along its bottom edge in the order of
 * their targets, so a fan-out never tangles at one exit. A case leaves its
 * decision node by the side facing its target, and a case that leads back
 * to the branch's own node is drawn as a loop around that card. Clicking
 * the label selects the edge.
 */
export default function LabeledEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  label,
  data,
  selected,
  style = {},
}: EdgeProps<CanvasEdge>) {
  const actions = useCanvasActions();
  const { setEdges, setNodes } = useReactFlow();
  const edges = useEdges<CanvasEdge>();
  const nodes = useNodes<FlowCanvasNode>();
  const sourceNode = useInternalNode(source);
  const fromDecision = data?.kind === "case" || data?.kind === "default";
  const sourceCard = useInternalNode(fromDecision ? (data?.sourceNodeId ?? "") : source);

  const text = typeof label === "string" ? label : "";
  const kind = data?.kind ?? "transition";
  const select = () => {
    setNodes((nds) => nds.map((node) => ({ ...node, selected: false })));
    setEdges((eds) => eds.map((edge) => ({ ...edge, selected: edge.id === id })));
    if (data) {
      const caseIndex =
        data.kind === "case" ? (data.caseIndex ?? null) : data.kind === "default" ? -1 : null;
      actions?.selectRow(data.sourceNodeId, data.functionIndex, caseIndex);
    }
  };
  const marker = selected ? ARROW_MARKER_SELECTED : ARROW_MARKER;
  const stroke = { ...style, strokeWidth: selected ? 1.5 : 1 };
  const box = nodeBox(sourceNode);

  // A case leading back to the branch's own node loops around that card
  if (fromDecision && sourceNode && sourceCard && target === data?.sourceNodeId) {
    const start: [number, number] = [box.right, box.y + box.height / 2];
    const { path, labelX, labelY } = loopPath(
      start,
      nodeBox(sourceCard),
      [targetX, targetY],
      data?.parallelIndex ?? 0
    );
    return (
      <>
        <BaseEdge id={id} path={path} markerEnd={marker} style={stroke} />
        <EdgeLabel
          text={text}
          kind={kind}
          x={labelX}
          y={labelY}
          selected={selected}
          onClick={select}
        />
      </>
    );
  }

  let startX = sourceX;
  let startY = sourceY;
  let startPosition = Position.Bottom;
  if (fromDecision && sourceNode) {
    // From a decision node, leave by the side that faces the target
    if (targetX < box.x - SIDE_MARGIN) {
      startX = box.x;
      startY = box.y + box.height / 2;
      startPosition = Position.Left;
    } else if (targetX > box.right + SIDE_MARGIN) {
      startX = box.right;
      startY = box.y + box.height / 2;
      startPosition = Position.Right;
    }
  } else if (sourceNode && box.width > 0) {
    // From a card, leave from a point along the bottom edge, in target order
    const centerOf = (nodeId: string) => {
      const n = nodes.find((node) => node.id === nodeId);
      return n ? n.position.x + (n.measured?.width ?? 0) / 2 : 0;
    };
    const siblings = edges
      .filter((e) => e.source === source && e.target !== e.source)
      .sort((a, b) => centerOf(a.target) - centerOf(b.target) || a.id.localeCompare(b.id));
    const index = Math.max(
      0,
      siblings.findIndex((e) => e.id === id)
    );
    if (siblings.length > 1) {
      const inset = Math.min(32, box.width / (siblings.length + 1) / 2);
      const span = box.width - inset * 2;
      startX = box.x + inset + (span * index) / (siblings.length - 1);
      startY = box.bottom;
    }
  }

  const [path, labelX, labelY] = getBezierPath({
    sourceX: startX,
    sourceY: startY,
    sourcePosition: startPosition,
    targetX,
    targetY,
    targetPosition: Position.Top,
    curvature: 0.3,
  });
  const stack = (data?.parallelIndex ?? 0) * STEP;

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={marker} style={stroke} />
      <EdgeLabel
        text={text}
        kind={kind}
        x={labelX}
        y={labelY + stack}
        selected={selected}
        onClick={select}
      />
    </>
  );
}
