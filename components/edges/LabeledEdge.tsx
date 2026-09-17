"use client";

import { BaseEdge, type EdgeProps, useInternalNode, useReactFlow } from "@xyflow/react";

import { ARROW_MARKER, ARROW_MARKER_SELECTED, type CanvasEdge } from "@/lib/convert/configToCanvas";
import { loopClearance } from "@/lib/layout/autoLayout";
import { useEditorStore } from "@/lib/store/editorStore";

import { useCanvasActions } from "../nodes/canvasActions";
import {
  ATTACH_INSET,
  DOWN,
  inward,
  loopPath,
  nodeBox,
  OUTWARD,
  sideOf,
  smoothPath,
  type Tangent,
} from "./edgeGeometry";
import EdgeLabel from "./EdgeLabel";

type Node = ReturnType<typeof useInternalNode>;

/**
 * Where an edge meets a node when it has no route: on a card, the point of
 * the bottom edge (leaving) or top edge (arriving) nearest the far end, or
 * the other way up when the far end is upstream; on a decision node, the
 * tip facing it.
 */
function attach(
  node: Node,
  far: [number, number],
  direction: "out" | "in"
): [number, number] | null {
  if (!node) return null;
  const box = nodeBox(node);
  if (box.width === 0) return null;
  const midY = box.y + box.height / 2;
  if (node.type === "decision") {
    if (direction === "in")
      return far[1] > box.bottom ? [box.centerX, box.bottom] : [box.centerX, box.y];
    if (far[0] < box.x - ATTACH_INSET || (far[1] < box.y && far[0] < box.centerX))
      return [box.x, midY];
    if (far[0] > box.right + ATTACH_INSET || far[1] < box.y) return [box.right, midY];
    return [box.centerX, box.bottom];
  }
  const x = Math.min(box.right - ATTACH_INSET, Math.max(box.x + ATTACH_INSET, far[0]));
  const upstream = far[1] < midY;
  const y = (direction === "out") !== upstream ? box.bottom : box.y;
  return [x, y];
}

/** The direction an edge leaves a node from a point on its border. */
function leaving(node: Node, point: [number, number]): Tangent {
  return node ? OUTWARD[sideOf(nodeBox(node), point)] : DOWN;
}

/** The direction an edge arrives at a node at a point on its border. */
function arriving(node: Node, point: [number, number]): Tangent {
  return node ? inward(sideOf(nodeBox(node), point)) : DOWN;
}

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
  // A route keyed by this edge's id from an earlier layout may belong to a
  // different edge now, since ids are reused when functions are removed,
  // reordered, or retargeted; it counts only between the same two nodes
  const stored = useEditorStore((state) => state.edgeRoutes[id]);
  const route =
    stored && stored.sourceNodeId === source && stored.targetNodeId === target ? stored : undefined;
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

  // A case leading back to the branch's own node loops around that card,
  // from the diamond's right tip
  if (fromDecision && sourceNode && sourceCard && target === data?.sourceNodeId) {
    const box = nodeBox(sourceNode);
    const { path, labelX, labelY } = loopPath(
      nodeBox(sourceCard),
      loopClearance(text),
      data?.parallelIndex ?? 0,
      [box.right, box.y + box.height / 2]
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

  // An edge without a route attaches along the border facing the other
  // node: on a card, anywhere along its bottom or top edge; on a decision
  // node, at the tip on that side.
  let points: Array<[number, number]> = [
    attach(sourceNode, [targetX, targetY], "out") ?? [sourceX, sourceY],
    attach(targetNode, [sourceX, sourceY], "in") ?? [targetX, targetY],
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
    // The layout attaches to a node's box, which may be wider than the card
    // when there is room beside it for a loop, so an end on the top or
    // bottom is kept within the card; a decision node's diamond meets its
    // box only at the four tips, so an end on the box moves to the tip on
    // that side.
    const snap = (node: Node, point: [number, number]): [number, number] => {
      if (!node) return point;
      const box = nodeBox(node);
      const midY = box.y + box.height / 2;
      if (node.type !== "decision") {
        const side = sideOf(box, point);
        if (side !== "top" && side !== "bottom") return point;
        const x = Math.min(box.right - ATTACH_INSET, Math.max(box.x + ATTACH_INSET, point[0]));
        return [x, side === "top" ? box.y : box.bottom];
      }
      switch (sideOf(box, point)) {
        case "left":
          return [box.x, midY];
        case "right":
          return [box.right, midY];
        case "top":
          return [box.centerX, box.y];
        default:
          return [box.centerX, box.bottom];
      }
    };
    points[0] = snap(sourceNode, points[0]);
    points[points.length - 1] = snap(targetNode, points[points.length - 1]);
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
  // The curve leaves and arrives square to the sides it meets, so an edge
  // back upstream, which the layout attaches to the target's bottom edge,
  // comes up into it with its head showing rather than down through the card
  const path = smoothPath(
    points,
    leaving(sourceNode, points[0]),
    arriving(targetNode, points[points.length - 1])
  );
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
