import type { InternalNode } from "@xyflow/react";

import { LOOP_STEP } from "@/lib/layout/autoLayout";

/** How far in from a card's corners an edge attaches. */
export const ATTACH_INSET = 24;

/** A rounded orthogonal path through the given corners, for loops drawn by hand. */
export function roundedPolyline(points: Array<[number, number]>, radius = 10): string {
  if (points.length < 2) return "";
  const parts = [`M ${points[0][0]} ${points[0][1]}`];
  for (let i = 1; i < points.length - 1; i += 1) {
    const [px, py] = points[i - 1];
    const [cx, cy] = points[i];
    const [nx, ny] = points[i + 1];
    const r = Math.min(radius, Math.hypot(cx - px, cy - py) / 2, Math.hypot(nx - cx, ny - cy) / 2);
    const inX = cx + Math.sign(px - cx) * r;
    const inY = cy + Math.sign(py - cy) * r;
    const outX = cx + Math.sign(nx - cx) * r;
    const outY = cy + Math.sign(ny - cy) * r;
    parts.push(`L ${inX} ${inY}`, `Q ${cx} ${cy} ${outX} ${outY}`);
  }
  const [lx, ly] = points[points.length - 1];
  parts.push(`L ${lx} ${ly}`);
  return parts.join(" ");
}

/** A node's box on the canvas, from its absolute position and measured size. */
export function nodeBox(node: InternalNode | undefined) {
  const x = node?.internals.positionAbsolute.x ?? 0;
  const y = node?.internals.positionAbsolute.y ?? 0;
  const width = node?.measured?.width ?? 0;
  const height = node?.measured?.height ?? 0;
  return { x, y, width, height, right: x + width, bottom: y + height, centerX: x + width / 2 };
}

/** Which side of a box a point on its border is on. */
export type Side = "top" | "bottom" | "left" | "right";

export function sideOf(box: ReturnType<typeof nodeBox>, [x, y]: [number, number]): Side {
  const distances: Record<Side, number> = {
    top: Math.abs(y - box.y),
    bottom: Math.abs(y - box.bottom),
    left: Math.abs(x - box.x),
    right: Math.abs(x - box.right),
  };
  return (Object.keys(distances) as Side[]).reduce((a, b) => (distances[b] < distances[a] ? b : a));
}

/** The direction out of a box from a side, and the direction into it. */
export const OUTWARD: Record<Side, Tangent> = {
  top: [0, -1],
  bottom: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};
export function inward(side: Side): Tangent {
  const [x, y] = OUTWARD[side];
  return [-x, -y];
}

/**
 * A loop around a card back into its own entry: out from the card's bottom
 * edge near its right corner, or from a decision node's tip below it, to
 * the right of the card by `clearance`, up past its top, and down into the
 * top edge near the right corner, clear of the entry in the middle that
 * other edges use. The label goes on the run up the side. `index` steps
 * concentric loops outward.
 */
export function loopPath(
  card: ReturnType<typeof nodeBox>,
  clearance: number,
  index: number,
  from?: [number, number]
): { path: string; labelX: number; labelY: number } {
  const out = index * LOOP_STEP;
  const cornerX = card.right - ATTACH_INSET - out;
  const start: [number, number] = from ?? [cornerX, card.bottom];
  const rightX = Math.max(start[0] + ATTACH_INSET, card.right + clearance) + out;
  const topY = card.y - 16 - out;
  // From the card's own bottom edge the loop first drops a little; from a
  // point below the card it runs straight across
  const runY = from ? start[1] : card.bottom + 16 + out;
  const points: Array<[number, number]> = [
    start,
    [start[0], runY],
    [rightX, runY],
    [rightX, topY],
    [cornerX, topY],
    [cornerX, card.y],
  ];
  if (from) points.splice(1, 1);
  return { path: roundedPolyline(points), labelX: rightX, labelY: (runY + topY) / 2 };
}

/** A direction an edge leaves or arrives in, as a unit vector. */
export type Tangent = [number, number];
export const DOWN: Tangent = [0, 1];

/**
 * The points with those dropped that lie within `tolerance` of the line
 * between their neighbors (Ramer-Douglas-Peucker), so a layout's waypoint
 * on every rank an edge crosses does not become a wobble in the curve.
 */
export function simplify(points: Array<[number, number]>, tolerance = 8): Array<[number, number]> {
  if (points.length <= 2) return points;
  const [ax, ay] = points[0];
  const [bx, by] = points[points.length - 1];
  const length = Math.hypot(bx - ax, by - ay);
  let farthest = 0;
  let at = 0;
  for (let i = 1; i < points.length - 1; i += 1) {
    const [px, py] = points[i];
    const d =
      length === 0
        ? Math.hypot(px - ax, py - ay)
        : Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / length;
    if (d > farthest) {
      farthest = d;
      at = i;
    }
  }
  if (farthest <= tolerance) return [points[0], points[points.length - 1]];
  const head = simplify(points.slice(0, at + 1), tolerance);
  const tail = simplify(points.slice(at), tolerance);
  return [...head, ...tail.slice(1)];
}

/**
 * A smooth curve through the points as cubic segments. It leaves the first
 * point and arrives at the last in the given directions, straight down
 * unless told otherwise, so the line meets a node square on. Every point
 * between is where the layout passes the edge between the nodes of a rank,
 * so the curve passes through it vertically, in the direction the edge is
 * traveling there: each stretch is then an S-curve with vertical ends, as
 * an edge drawn straight between two nodes is, and there are no corners.
 * A control point reaches half the stretch's extent along its direction,
 * so a short hop stays gentle and a long run stays straight.
 */
export function smoothPath(
  points: Array<[number, number]>,
  start: Tangent = DOWN,
  end: Tangent = DOWN
): string {
  const pts = simplify(points);
  if (pts.length < 2) return "";
  const unit = ([x, y]: Tangent): Tangent => {
    const n = Math.hypot(x, y) || 1;
    return [x / n, y / n];
  };
  const last = pts.length - 1;
  const tangents = pts.map((p, i): Tangent => {
    if (i === 0) return unit(start);
    if (i === last) return unit(end);
    return pts[i + 1][1] >= pts[i - 1][1] ? DOWN : [0, -1];
  });
  const parts = [`M ${pts[0][0]} ${pts[0][1]}`];
  for (let i = 0; i < last; i += 1) {
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const t1 = tangents[i];
    const t2 = tangents[i + 1];
    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    const reach1 = Math.max(12, Math.abs(dx * t1[0] + dy * t1[1]) / 2);
    const reach2 = Math.max(12, Math.abs(dx * t2[0] + dy * t2[1]) / 2);
    const c1x = p1[0] + t1[0] * reach1;
    const c1y = p1[1] + t1[1] * reach1;
    const c2x = p2[0] - t2[0] * reach2;
    const c2y = p2[1] - t2[1] * reach2;
    parts.push(`C ${c1x} ${c1y} ${c2x} ${c2y} ${p2[0]} ${p2[1]}`);
  }
  return parts.join(" ");
}
