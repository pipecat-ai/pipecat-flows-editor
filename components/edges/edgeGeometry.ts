import type { InternalNode } from "@xyflow/react";

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

/**
 * A loop from a point below or beside a card back into the card's entry at
 * the top: out to the right of the card, up, across, and down into the
 * entry. `index` steps concentric loops outward.
 */
export function loopPath(
  start: [number, number],
  card: ReturnType<typeof nodeBox>,
  entry: [number, number],
  index: number
): { path: string; labelX: number; labelY: number } {
  const step = 14;
  const rightX = Math.max(start[0], card.right) + 24 + index * step;
  const topY = card.y - 16 - index * step;
  const points: Array<[number, number]> = [
    start,
    [start[0], Math.max(start[1], card.bottom) + 16 + index * step],
    [rightX, Math.max(start[1], card.bottom) + 16 + index * step],
    [rightX, topY],
    [entry[0], topY],
    entry,
  ];
  // The start may already be to the right of the card; then the first leg is horizontal
  if (start[0] >= rightX - 1) points.splice(1, 1);
  return { path: roundedPolyline(points), labelX: rightX, labelY: (points[2][1] + topY) / 2 };
}

/**
 * A smooth curve through the points, as cubic segments whose control points
 * follow the neighbors (a Catmull-Rom spline), so an edge threads its
 * layout waypoints without corners.
 */
export function smoothPath(points: Array<[number, number]>): string {
  if (points.length < 2) return "";
  if (points.length === 2) {
    const [[x0, y0], [x1, y1]] = points;
    const dy = Math.max(40, Math.abs(y1 - y0) * 0.4);
    return `M ${x0} ${y0} C ${x0} ${y0 + dy} ${x1} ${y1 - dy} ${x1} ${y1}`;
  }
  const parts = [`M ${points[0][0]} ${points[0][1]}`];
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    parts.push(`C ${c1x} ${c1y} ${c2x} ${c2y} ${p2[0]} ${p2[1]}`);
  }
  return parts.join(" ");
}
