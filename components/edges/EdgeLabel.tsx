"use client";

import { EdgeLabelRenderer } from "@xyflow/react";
import { Split } from "lucide-react";

import type { CanvasEdgeKind } from "@/lib/convert/configToCanvas";
import { EDGE_LABEL } from "@/lib/layout/autoLayout";

/**
 * An edge's text as a square tag in the inverse of the card's colors, so
 * a label and a card can never be mistaken for each other; under the
 * pointer and when selected the tag goes brand. The edge into a branch
 * carries a glyph, since the diamond it leads to is the only other sign
 * that the function's result is branched on; a transition's direction is
 * its arrowhead, and a case is known by the diamond it leaves. A selected
 * edge's pill is brand.
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
  const branch = kind === "branch";
  return (
    <EdgeLabelRenderer>
      <button
        type="button"
        className={`nodrag nopan pointer-events-auto absolute flex items-center gap-1 rounded-sm border py-0.5 font-mono text-[11px] leading-4 transition-colors ${
          branch ? "pr-2 pl-1.5" : "px-2"
        } ${
          selected
            ? "border-brand bg-brand text-white dark:text-zinc-950"
            : "border-transparent bg-primary text-primary-foreground hover:bg-brand hover:text-white dark:hover:text-zinc-950"
        } ${kind === "default" ? "italic" : ""}`}
        style={{ transform: `translate(-50%, -50%) translate(${x}px, ${y}px)` }}
        title={text}
        onClick={onClick}
      >
        {branch && <Split className="size-3 shrink-0 opacity-70" />}
        {shown}
      </button>
    </EdgeLabelRenderer>
  );
}
