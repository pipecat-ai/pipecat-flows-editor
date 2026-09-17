"use client";

import { EdgeLabelRenderer } from "@xyflow/react";
import { ArrowRight, CornerDownRight, Split } from "lucide-react";

import type { CanvasEdgeKind } from "@/lib/convert/configToCanvas";
import { EDGE_LABEL } from "@/lib/layout/autoLayout";

const GLYPHS = {
  transition: ArrowRight,
  branch: Split,
  case: CornerDownRight,
  default: CornerDownRight,
} satisfies Record<CanvasEdgeKind, typeof ArrowRight>;

/**
 * An edge's text as a pill in the inverse of the card's colors, so a label
 * and a node can never be mistaken for each other, with a glyph for what
 * the edge is: a transition, the way into a branch, or one of its cases.
 * A selected edge's pill is brand.
 */
export default function EdgeLabel({
  text,
  kind,
  x,
  y,
  selected,
  onClick,
}: {
  text: string;
  kind: CanvasEdgeKind;
  x: number;
  y: number;
  selected?: boolean;
  onClick: () => void;
}) {
  if (!text) return null;
  const shown =
    text.length > EDGE_LABEL.maxChars ? `${text.slice(0, EDGE_LABEL.maxChars - 1)}…` : text;
  const Glyph = GLYPHS[kind];
  return (
    <EdgeLabelRenderer>
      <button
        type="button"
        className={`nodrag nopan pointer-events-auto absolute flex items-center gap-1 rounded-full py-0.5 pr-2 pl-1.5 font-mono text-[11px] leading-4 transition-colors ${
          selected
            ? "bg-brand text-white"
            : "bg-primary text-primary-foreground hover:bg-brand hover:text-white"
        } ${kind === "default" ? "italic" : ""}`}
        style={{ transform: `translate(-50%, -50%) translate(${x}px, ${y}px)` }}
        title={text}
        onClick={onClick}
      >
        <Glyph className="size-3 shrink-0 opacity-70" />
        {shown}
      </button>
    </EdgeLabelRenderer>
  );
}
