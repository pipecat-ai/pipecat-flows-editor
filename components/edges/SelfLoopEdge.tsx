"use client";

import { BaseEdge, EdgeProps, useNodes } from "@xyflow/react";

import { type CanvasNode, nodeFunctions } from "@/lib/convert/configToCanvas";

/**
 * Builds the geometry for a self-loop edge
 * @param startX - The x-coordinate of the start point
 * @param startY - The y-coordinate of the start point
 * @param endX - The x-coordinate of the end point
 * @param endY - The y-coordinate of the end point
 * @param baseHorizontalSpacing - The base horizontal spacing
 * @param verticalSpacing - The vertical spacing
 * @param cornerRadius - The corner radius
 * @param horizontalOffset - The horizontal offset
 * @returns The geometry for the self-loop edge
 */
function buildSelfLoopGeometry({
  startX,
  startY,
  endX,
  endY,
  baseHorizontalSpacing,
  verticalSpacing,
  cornerRadius,
  horizontalOffset,
}: {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  baseHorizontalSpacing: number;
  verticalSpacing: number;
  cornerRadius: number;
  horizontalOffset: number;
}) {
  const totalHorizontalSpacing = baseHorizontalSpacing + horizontalOffset;
  const bottomY = startY + verticalSpacing;
  const topY = endY - verticalSpacing;
  const leftX = startX - totalHorizontalSpacing;

  const path = [
    `M ${startX} ${startY}`,
    `L ${startX} ${bottomY - cornerRadius}`,
    `C ${startX} ${bottomY - cornerRadius * 0.5}, ${startX - cornerRadius * 0.5} ${bottomY}, ${startX - cornerRadius} ${bottomY}`,
    `L ${leftX + cornerRadius} ${bottomY}`,
    `C ${leftX + cornerRadius * 0.5} ${bottomY}, ${leftX} ${bottomY - cornerRadius * 0.5}, ${leftX} ${bottomY - cornerRadius}`,
    `L ${leftX} ${topY + cornerRadius}`,
    `C ${leftX} ${topY + cornerRadius * 0.5}, ${leftX + cornerRadius * 0.5} ${topY}, ${leftX + cornerRadius} ${topY}`,
    `L ${endX - cornerRadius} ${topY}`,
    `C ${endX - cornerRadius * 0.5} ${topY}, ${endX} ${topY + cornerRadius * 0.5}, ${endX} ${topY + cornerRadius}`,
    `L ${endX} ${endY}`,
  ].join(" ");

  return {
    path,
    labelX: leftX,
    labelY: (bottomY + topY) / 2,
  };
}

export default function SelfLoopEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  source,
  style = {},
  markerEnd,
  label,
}: EdgeProps) {
  // Get the source node to determine its actual dimensions for label spacing
  const nodes = useNodes();
  const sourceNode = nodes.find((n) => n.id === source) as CanvasNode | undefined;
  const selfLoopFunctions = nodeFunctions(sourceNode).filter(
    (func) => func.transition_to === sourceNode?.id
  );
  const nodeWidth = sourceNode?.width ?? 150;

  // For self-loops, source and target are the same node
  // Start from the bottom handle (source) and loop around to the top handle (target)
  const startX = sourceX;
  const startY = sourceY;
  const endX = targetX;
  const endY = targetY;

  const labelText = label ? String(label) : "";
  const measureLabelWidth = (text: string) => text.length * 6 + 4;
  const labelWidth = measureLabelWidth(labelText);

  // Determine loop index for multiple self-loops (avoid overlap)
  const loopIndex = selfLoopFunctions.findIndex((func) => func.name === labelText);
  const normalizedLoopIndex = loopIndex >= 0 ? loopIndex : 0;

  // Calculate spacing for the loop
  const baseVerticalSpacing = 10;
  const verticalSpacing = baseVerticalSpacing + normalizedLoopIndex * 2;

  const minSpacing = nodeWidth / 2 + 10;
  const labelPadding = 4;
  const cumulativeLabelWidth =
    normalizedLoopIndex > 0
      ? selfLoopFunctions.slice(0, normalizedLoopIndex).reduce((acc, func) => {
          const text = func.name ?? "";
          const width = measureLabelWidth(text);
          return acc + width + labelPadding;
        }, 0)
      : 0;
  const baseSpacing = minSpacing + labelWidth / 2;
  const horizontalOffset = cumulativeLabelWidth;

  const cornerRadius = 24;

  const {
    path: loopPath,
    labelX,
    labelY,
  } = buildSelfLoopGeometry({
    startX,
    startY,
    endX,
    endY,
    baseHorizontalSpacing: baseSpacing,
    verticalSpacing,
    cornerRadius,
    horizontalOffset,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={loopPath}
        markerEnd={markerEnd}
        style={{
          ...style,
          strokeWidth: 1,
        }}
      />
      {label && (
        <g transform={`translate(${labelX} ${labelY})`}>
          <rect
            width={labelWidth}
            x={-labelWidth / 2}
            y={-8}
            height={16}
            className="react-flow__edge-textbg"
            rx="2"
            ry="2"
          />
          <text
            x={0}
            y={0}
            textAnchor="middle"
            dominantBaseline="middle"
            className="react-flow__edge-text"
          >
            {label}
          </text>
        </g>
      )}
    </>
  );
}
