"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import React from "react";

/**
 * A collapsible segment of the sidebar: a header row with a chevron, a
 * title, and trailing controls, and a body that expands beneath. Segments
 * stack edge to edge in a list that divides them with hairlines, one level
 * flatter than a card. Selection and trouble show as a 2px edge on the left, and only
 * there, which no scrolling container can clip.
 */
interface SegmentProps {
  title: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  selected?: boolean;
  invalid?: boolean;
  /** Controls at the right of the header, such as a remove button. */
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export const Segment = React.forwardRef<HTMLDivElement, SegmentProps>(function Segment(
  { title, expanded, onToggle, selected, invalid, actions, children },
  ref
) {
  const edge = selected
    ? "border-l-brand"
    : invalid
      ? "border-l-orange-500"
      : "border-l-transparent";
  return (
    <div ref={ref} className={`border-l-2 ${edge}`}>
      <div className="flex items-center gap-1 pr-2 pl-[calc(--spacing(3)_-_2px)]">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="flex h-9 min-w-0 flex-1 items-center gap-2 text-left outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {expanded ? (
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          )}
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{title}</span>
        </button>
        {actions}
      </div>
      <div
        className={`overflow-hidden transition-all duration-200 ease-in-out ${
          expanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="space-y-4 px-3 pb-3 pl-[calc(--spacing(3)_-_2px)]">{children}</div>
      </div>
    </div>
  );
});
