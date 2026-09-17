"use client";

import type { NodeProps } from "@xyflow/react";
import { ArrowRight, Globe, Split, Wrench } from "lucide-react";

import { type GlobalCanvasNode } from "@/lib/convert/configToCanvas";
import { NODE_CARD } from "@/lib/layout/autoLayout";
import { isBranch } from "@/lib/schema/flowConfig";
import { useEditorStore } from "@/lib/store/editorStore";

import { NAME_LIMITS } from "./BaseNode";

/**
 * The functions offered at every node, as one card: a row per function,
 * a tool that stays where the conversation is with the wrench, one that
 * leads somewhere with an arrow and where it leads. There is no edge from
 * here, since it could leave from any node. A row opens the function in
 * the Flow panel. The card is derived from the global functions, never written to
 * the config as a node.
 */
export default function GlobalNode({ data, selected }: NodeProps<GlobalCanvasNode>) {
  const selectedGlobal = useEditorStore((state) => state.selectedGlobalIndex);
  const selectGlobal = useEditorStore((state) => state.selectGlobal);
  const setSidebarCollapsed = useEditorStore((state) => state.setSidebarCollapsed);
  const iconClass = "h-[13px] w-[13px] shrink-0 text-muted-foreground";
  const cap = (text: string, limit: number) =>
    text.length > limit ? `${text.slice(0, limit - 1)}…` : text;

  return (
    <div
      className={`relative rounded-lg border border-dashed bg-card text-xs ${
        selected ? "border-brand ring-1 ring-brand" : "border-accent-line"
      }`}
      style={{ width: NODE_CARD.width }}
      title="Global functions: offered at every node"
    >
      <div
        className="flex items-center gap-1.5 border-b px-2.5 text-[13px] font-semibold"
        style={{ height: NODE_CARD.headerHeight }}
      >
        <Globe className={iconClass} />
        <span className="flex-1 truncate">Every node</span>
        <span className="font-normal text-muted-foreground">global</span>
      </div>
      <div className="py-1">
        {data.functions.map((fn, index) => {
          const transition = fn.transition_to;
          const leadsTo =
            transition === undefined || transition === null
              ? null
              : isBranch(transition)
                ? `branch on ${transition.field || "a field"}`
                : transition;
          const Icon = leadsTo === null ? Wrench : isBranch(transition) ? Split : ArrowRight;
          return (
            <button
              key={index}
              type="button"
              className={`flex w-full items-center gap-1.5 pl-2.5 pr-2 text-left ${
                selectedGlobal === index ? "bg-brand/10" : "hover:bg-muted/60"
              }`}
              style={{ height: NODE_CARD.rowHeight }}
              title={
                leadsTo === null
                  ? `${fn.name || "This function"} is offered at every node and stays where the conversation is`
                  : `${fn.name || "This function"} is offered at every node and leads to ${leadsTo}`
              }
              onClick={() => {
                setSidebarCollapsed(false);
                selectGlobal(index);
              }}
            >
              <Icon className={iconClass} />
              <span
                className={`truncate font-mono ${fn.name ? "" : "italic text-muted-foreground"}`}
              >
                {cap(fn.name || `function ${index + 1}`, NAME_LIMITS.tool)}
              </span>
              {leadsTo !== null && (
                <span className="ml-auto truncate font-mono text-muted-foreground">
                  → {cap(leadsTo, NAME_LIMITS.node)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
