"use client";

import { BaseEdge, type EdgeProps, useNodes } from "@xyflow/react";

import { type CanvasNode, nodeFunctions } from "@/lib/convert/configToCanvas";
import { functionTargets } from "@/lib/schema/flowConfig";

/**
 * An edge from a row's port on the right of a card back into the card's own
 * left handle: out to the right, up over the card, and around into the left.
 * Several loops on one card step outward so they stay apart.
 */
export default function SelfLoopEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  source,
  sourceHandleId,
  style = {},
  markerEnd,
}: EdgeProps) {
  const nodes = useNodes();
  const sourceNode = nodes.find((n) => n.id === source) as CanvasNode | undefined;
  const nodeRight = (sourceNode?.position.x ?? 0) + (sourceNode?.measured?.width ?? 0);
  const nodeTop = sourceNode?.position.y ?? targetY;

  // Which of this node's self-loops this is, in row order
  const loopHandles = nodeFunctions(sourceNode)
    .filter((fn) => functionTargets(fn).includes(source))
    .map((fn) => `fn:${fn.name}`);
  const loopIndex = Math.max(
    0,
    loopHandles.findIndex((prefix) => sourceHandleId?.startsWith(prefix))
  );

  const step = 14;
  const rightX = Math.max(sourceX, nodeRight) + 24 + loopIndex * step;
  const topY = nodeTop - 20 - loopIndex * step;
  const leftX = targetX - 24 - loopIndex * step;
  const r = 10;

  const path = [
    `M ${sourceX} ${sourceY}`,
    `L ${rightX - r} ${sourceY}`,
    `Q ${rightX} ${sourceY} ${rightX} ${sourceY - r}`,
    `L ${rightX} ${topY + r}`,
    `Q ${rightX} ${topY} ${rightX - r} ${topY}`,
    `L ${leftX + r} ${topY}`,
    `Q ${leftX} ${topY} ${leftX} ${topY + r}`,
    `L ${leftX} ${targetY - r}`,
    `Q ${leftX} ${targetY} ${leftX + r} ${targetY}`,
    `L ${targetX} ${targetY}`,
  ].join(" ");

  return (
    <BaseEdge id={id} path={path} markerEnd={markerEnd} style={{ ...style, strokeWidth: 1 }} />
  );
}
