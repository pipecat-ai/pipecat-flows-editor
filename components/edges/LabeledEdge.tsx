"use client";

import { BaseEdge, type EdgeProps, useInternalNode, useReactFlow } from "@xyflow/react";

import { ARROW_MARKER, ARROW_MARKER_SELECTED, type CanvasEdge } from "@/lib/convert/configToCanvas";
import { useEditorStore } from "@/lib/store/editorStore";

import { useCanvasActions } from "../nodes/canvasActions";
import { loopPath, nodeBox, smoothPath } from "./edgeGeometry";
import EdgeLabel from "./EdgeLabel";

/**
 * An edge with its function name or case value on it. The layout owns the
 * geometry: the edge is a smooth curve through the route the layout gave
 * it, which leaves the source's border, passes beside the nodes in between,
 * and arrives at the target's border, with the label in the slot the layout
 * reserved for it. When a node is moved by hand, its end of every route
 * moves with it, fading out toward the other end, so the edge keeps its
 * shape and never jumps. An edge that has no route yet, added since the
 * last layout, is a plain curve between the handles. A case that leads
 * back to the branch's own node is drawn as a loop around that card, since
 * the layout does not route those. Clicking the label selects the edge.
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
  const route = useEditorStore((state) => state.edgeRoutes[id]);
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
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

  // A case leading back to the branch's own node loops around that card
  if (fromDecision && sourceNode && sourceCard && target === data?.sourceNodeId) {
    const box = nodeBox(sourceNode);
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

  let points: Array<[number, number]> = [
    [sourceX, sourceY],
    [targetX, targetY],
  ];
  let labelAt: { x: number; y: number } | undefined;
  if (route && route.points.length >= 2 && sourceNode && targetNode) {
    // The route stretches with its endpoints: a node moved by hand carries
    // its end of the route with it, fading out toward the other end, so
    // the edge keeps its shape and its label and never jumps.
    const from = sourceNode.internals.positionAbsolute;
    const to = targetNode.internals.positionAbsolute;
    const shift = (fraction: number, x: number, y: number): [number, number] => [
      x + (from.x - route.source.x) * (1 - fraction) + (to.x - route.target.x) * fraction,
      y + (from.y - route.source.y) * (1 - fraction) + (to.y - route.target.y) * fraction,
    ];
    const last = route.points.length - 1;
    points = route.points.map((p, i) => shift(i / last, p.x, p.y));
    // The layout attaches to a node's box; a decision node's diamond meets
    // its box only at the four tips, so an end on its bottom or top edge
    // moves to the tip there.
    const snap = (node: typeof sourceNode, point: [number, number], edge: "top" | "bottom") => {
      if (!node || node.type !== "decision") return point;
      const box = nodeBox(node);
      const y = edge === "bottom" ? box.bottom : box.y;
      return Math.abs(point[1] - y) < 2 ? ([box.centerX, y] as [number, number]) : point;
    };
    points[0] = snap(sourceNode, points[0], "bottom");
    points[points.length - 1] = snap(targetNode, points[points.length - 1], "top");
    if (route.label) {
      // The label moves with the nearest stretch of the route
      const nearest = route.points.reduce(
        (best, p, i) => {
          const d = Math.hypot(p.x - route.label!.x, p.y - route.label!.y);
          return d < best.d ? { d, i } : best;
        },
        { d: Infinity, i: 0 }
      ).i;
      const [x, y] = shift(nearest / last, route.label.x, route.label.y);
      labelAt = { x, y };
    }
  }
  const path = smoothPath(points);
  const mid = points[Math.floor(points.length / 2)];
  const labelX = labelAt?.x ?? (points.length === 2 ? (points[0][0] + points[1][0]) / 2 : mid[0]);
  const labelY = labelAt?.y ?? (points.length === 2 ? (points[0][1] + points[1][1]) / 2 : mid[1]);

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
