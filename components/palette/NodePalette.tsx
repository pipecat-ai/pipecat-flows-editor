"use client";

import { NODE_TEMPLATES } from "@/lib/nodes/templates";
import { Button } from "@/components/ui/button";
import { deriveNodeType } from "@/lib/utils/nodeType";
import type { Node } from "reactflow";

type Props = {
  nodes: Node[];
};

export default function NodePalette({ nodes }: Props) {
  // Check if an initial node already exists
  const hasInitialNode = nodes.some(
    (n) => deriveNodeType(n.data as Record<string, unknown>, n.type as string) === "initial"
  );

  return (
    <aside className="w-56 shrink-0 border-r bg-white/70 p-2 text-sm backdrop-blur dark:bg-black/40 flex flex-col overflow-hidden h-full">
      <div className="mb-2 px-2 text-xs font-semibold uppercase opacity-70 shrink-0">Nodes</div>
      <div className="flex flex-col gap-2 overflow-y-auto flex-1 min-h-0 pr-1">
        {NODE_TEMPLATES.map((t) => {
          const isInitial = t.type === "initial";
          const isDisabled = isInitial && hasInitialNode;
          return (
            <Button
              key={t.type}
              variant="outline"
              className="h-auto! w-full flex-col items-start px-2! py-2! text-left shadow-sm"
              style={{ height: "auto" }}
              disabled={isDisabled}
              draggable={!isDisabled}
              onDragStart={(e) => {
                if (isDisabled) {
                  e.preventDefault();
                  return;
                }
                e.dataTransfer.setData("application/x-node-type", t.type);
                e.dataTransfer.effectAllowed = "move";
              }}
              title={isDisabled ? "Only one initial node is allowed" : undefined}
            >
              <div className="text-[13px] font-medium leading-tight">{t.label}</div>
              <div className="text-[11px] opacity-60 leading-tight">{t.type}</div>
            </Button>
          );
        })}
      </div>
    </aside>
  );
}
