"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import MessagesForm from "./forms/MessagesForm";
import FunctionsForm from "./forms/FunctionsForm";
import ActionsForm from "./forms/ActionsForm";
import ContextStrategyForm from "./forms/ContextStrategyForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { showToast } from "@/components/ui/Toast";
import { generateNodeIdFromLabel } from "@/lib/utils/nodeId";
import { deriveNodeType } from "@/lib/utils/nodeType";
import { useEditorStore } from "@/lib/store/editorStore";

type Props = {
  nodes: any[];
  onChange: (next: { id: string; data: any }) => void;
  onDelete: (id: string, kind: "node" | "edge") => void;
  onRenameNode?: (oldId: string, newId: string) => void;
  availableNodeIds?: string[];
};

export default function InspectorPanel({
  nodes,
  onChange,
  onDelete,
  onRenameNode,
  availableNodeIds = [],
}: Props) {
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);

  const selected = selectedNodeId ? (nodes.find((n) => n.id === selectedNodeId) ?? null) : null;
  const id = selected?.id;
  const data = selected?.data;
  // Derive the displayed type from the node data (especially post_actions)
  const displayedType = deriveNodeType(data, selected?.type);

  // Local state for label input to prevent focus loss during typing
  // Initialize with current label, sync only when node ID changes (not label)
  const [labelValue, setLabelValue] = useState<string>("");
  const prevIdRef = useRef<string | undefined>(id);
  const isRenamingRef = useRef(false);

  // Sync labelValue when the node ID changes (user selected a different node)
  // This prevents losing focus while typing in the same node
  useEffect(() => {
    // Sync if the node ID changed (user selected different node) or on initial mount
    // Don't sync if we're in the middle of a rename - keep the user's input
    if (prevIdRef.current === undefined || id !== prevIdRef.current) {
      if (!isRenamingRef.current) {
        // Node changed or initial mount, sync from data
        setLabelValue((data?.label as string) ?? "");
      }
      prevIdRef.current = id;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]); // Only sync when node ID changes

  // After rename completes, reset the flag when data.label matches our input
  useEffect(() => {
    if (isRenamingRef.current && data?.label === labelValue) {
      // Rename completed successfully, reset the flag
      isRenamingRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.label]); // Only check data?.label, not labelValue

  // All hooks must be called before any conditional returns
  const update = useCallback(
    (partial: Partial<{ label: string; [k: string]: unknown }>) => {
      if (!selected || !id) return; // Guard against null selected

      const next = { ...(data ?? {}), ...partial };

      // If label changed, auto-update the ID
      if (partial.label !== undefined && partial.label !== data?.label && onRenameNode) {
        const newLabel = partial.label as string;
        if (newLabel && newLabel.trim() !== "") {
          const otherNodeIds = availableNodeIds.filter((nodeId) => nodeId !== id);
          const newId = generateNodeIdFromLabel(newLabel, otherNodeIds);

          // Only rename if the generated ID is different from current
          if (newId !== id) {
            // Update the node ID first (this handles all references)
            onRenameNode(id, newId);
            // Then update the data with the new ID
            onChange({ id: newId, data: next });
            return;
          }
        }
      }

      onChange({ id, data: next });
    },
    [selected, id, data, onChange, onRenameNode, availableNodeIds]
  );

  // Early return after all hooks
  if (!selected) {
    return (
      <aside className="w-72 shrink-0 border-l bg-white/70 p-3 text-sm backdrop-blur dark:bg-black/40 flex flex-col overflow-hidden h-full">
        <div className="opacity-60">Select a node or edge</div>
      </aside>
    );
  }

  return (
    <aside className="w-72 shrink-0 border-l bg-white/70 p-3 text-sm backdrop-blur dark:bg-black/40 flex flex-col overflow-hidden h-full">
      <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase opacity-70 shrink-0">
        <span>Inspector</span>
        <Button
          variant="secondary"
          size="sm"
          className="h-6 text-[10px] normal-case px-2"
          onClick={() => onDelete(id, "node")}
          title="Delete node"
        >
          Delete
        </Button>
      </div>
      <div className="space-y-3 overflow-y-auto flex-1 min-h-0 pr-1">
        <div>
          <div className="text-[11px] opacity-60">ID (auto-generated)</div>
          <div className="truncate font-mono text-[12px] text-neutral-500">{id}</div>
        </div>
        {displayedType && (
          <div>
            <div className="text-[11px] opacity-60">Type</div>
            <div className="text-[12px]">{displayedType}</div>
          </div>
        )}
        <label className="block">
          <div className="mb-1 text-[11px] opacity-60">Label</div>
          <Input
            value={labelValue}
            onChange={(e) => {
              setLabelValue(e.target.value);
            }}
            onBlur={() => {
              // Update the label and potentially rename the node ID on blur
              if (labelValue !== (data?.label as string)) {
                // Set flag to indicate we're renaming, so useEffect won't reset the value
                isRenamingRef.current = true;
                update({ label: labelValue });
              }
            }}
            placeholder="Label"
          />
        </label>

        {/* Pipecat Flows fields */}
        {displayedType === "initial" && (
          <MessagesForm
            label="Role Messages"
            messages={data?.role_messages}
            onChange={(msgs) => update({ role_messages: msgs })}
          />
        )}
        <MessagesForm
          label="Task Messages"
          messages={data?.task_messages}
          onChange={(msgs) => update({ task_messages: msgs })}
        />
        <FunctionsForm
          functions={data?.functions}
          onChange={(funcs) => update({ functions: funcs })}
          availableNodeIds={availableNodeIds}
          currentNodeId={id}
        />
        <ActionsForm
          label="Pre Actions"
          actions={data?.pre_actions}
          onChange={(actions) => update({ pre_actions: actions })}
        />
        <ActionsForm
          label="Post Actions"
          actions={data?.post_actions}
          onChange={(actions) => update({ post_actions: actions })}
        />
        <ContextStrategyForm
          contextStrategy={data?.context_strategy}
          onChange={(strategy) => update({ context_strategy: strategy })}
        />
        <div className="flex items-center space-x-2">
          <Checkbox
            id="respond_immediately"
            checked={data?.respond_immediately !== false}
            onCheckedChange={(checked) => update({ respond_immediately: checked === true })}
          />
          <label
            htmlFor="respond_immediately"
            className="text-[11px] opacity-60 cursor-pointer leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Respond Immediately
          </label>
        </div>
        <div className="block">
          <div className="mb-1 flex items-center justify-between">
            <div className="text-[11px] opacity-60">Data (JSON)</div>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 text-[9px] px-2"
              onClick={async () => {
                const jsonText = JSON.stringify({ ...data, label: undefined }, null, 2);
                try {
                  await navigator.clipboard.writeText(jsonText);
                  showToast("Copied to clipboard", "success");
                } catch (err) {
                  console.warn(err);
                  showToast("Failed to copy to clipboard", "error");
                }
              }}
              title="Copy to clipboard"
            >
              Copy
            </Button>
          </div>
          <Textarea
            className="h-40 font-mono text-xs"
            value={JSON.stringify({ ...data, label: undefined }, null, 2)}
            readOnly
          />
        </div>
      </div>
    </aside>
  );
}
