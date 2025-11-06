"use client";

import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Node } from "reactflow";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { showToast } from "@/components/ui/Toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useEditorStore } from "@/lib/store/editorStore";
import { generateNodeIdFromLabel } from "@/lib/utils/nodeId";
import { deriveNodeType } from "@/lib/utils/nodeType";

import ActionsForm from "./forms/ActionsForm";
import ContextStrategyForm from "./forms/ContextStrategyForm";
import FunctionsForm from "./forms/FunctionsForm";
import MessagesForm from "./forms/MessagesForm";

type Props = {
  nodes: Node[];
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
  const selectedFunctionIndex = useEditorStore((state) => state.selectedFunctionIndex);
  const selectedConditionIndex = useEditorStore((state) => state.selectedConditionIndex);
  const inspectorPanelWidth = useEditorStore((state) => state.inspectorPanelWidth);
  const setInspectorPanelWidth = useEditorStore((state) => state.setInspectorPanelWidth);
  const setIsInspectorResizing = useEditorStore((state) => state.setIsInspectorResizing);

  const selected = selectedNodeId ? (nodes.find((n) => n.id === selectedNodeId) ?? null) : null;
  const id = selected?.id;
  const data = selected?.data;
  // Derive the displayed type from the node data (especially post_actions)
  const displayedType = deriveNodeType(data, selected?.type);

  const [showJson, setShowJson] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("general");
  const prevSelectedNodeIdRef = useRef<string | null>(selectedNodeId);

  // Automatically switch to Functions tab when a function is selected (decision nodes/edges)
  // Reset to General tab when node changes and no function is selected
  useEffect(() => {
    if (selectedFunctionIndex !== null) {
      setActiveTab("functions");
    } else if (selectedNodeId && prevSelectedNodeIdRef.current !== selectedNodeId) {
      // Node changed and no function selected - reset to general
      setActiveTab("general");
    }
    prevSelectedNodeIdRef.current = selectedNodeId;
  }, [selectedFunctionIndex, selectedConditionIndex, selectedNodeId]);

  const update = useCallback(
    (partial: Partial<{ label: string; [k: string]: unknown }>) => {
      if (!selected || !id) return;

      const next = { ...(data ?? {}), ...partial };

      if (partial.label !== undefined && partial.label !== data?.label) {
        const newLabel = partial.label as string;
        if (newLabel && newLabel.trim() !== "") {
          const otherNodeIds = availableNodeIds.filter((nodeId) => nodeId !== id);
          const newId = generateNodeIdFromLabel(newLabel, otherNodeIds);

          if (newId !== id) {
            onChange({ id, data: next });
            onRenameNode?.(id, newId);
            return;
          }
        }
      }

      onChange({ id, data: next });
    },
    [selected, id, data, onChange, onRenameNode, availableNodeIds]
  );

  // Resize handle handler
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsInspectorResizing(true);
    const startX = e.clientX;
    const startWidth = inspectorPanelWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = startX - moveEvent.clientX; // Inverted because we're dragging left
      const newWidth = Math.max(320, Math.min(800, startWidth + delta));
      setInspectorPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsInspectorResizing(false);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  // Early return after all hooks
  if (!selected) {
    return (
      <aside
        className="relative shrink-0 border-l bg-white/70 backdrop-blur dark:bg-black/40 flex flex-col overflow-hidden h-full"
        style={{ width: `${inspectorPanelWidth}px` }}
      >
        <div
          className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-blue-500 bg-transparent z-20"
          onMouseDown={handleResizeStart}
          aria-label="Resize inspector panel"
          role="separator"
          aria-orientation="vertical"
        />
        <div className="p-3 text-sm">
          <div className="opacity-60">Select a node or edge</div>
        </div>
      </aside>
    );
  }

  return (
    <aside
      className="relative z-20 shrink-0 border-l bg-white/70 backdrop-blur dark:bg-black/40 flex flex-col overflow-hidden h-full"
      style={{ width: `${inspectorPanelWidth}px` }}
    >
      {/* Resize handle */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-blue-500 bg-transparent z-20"
        onMouseDown={handleResizeStart}
        aria-label="Resize inspector panel"
        role="separator"
        aria-orientation="vertical"
      />

      {/* Header */}
      <div className="mb-2 flex items-center justify-between px-3 pt-3 text-xs font-semibold uppercase opacity-70 shrink-0">
        <span>Inspector</span>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="secondary"
                size="sm"
                className="h-6 w-6"
                onClick={() => onDelete(id as string, "node")}
              >
                <Trash2 />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Delete node</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex flex-col flex-1 min-h-0 px-3"
      >
        <TabsList className="grid w-full grid-cols-4 mb-2 shrink-0">
          <TabsTrigger value="general" className="text-[10px] px-2">
            General
          </TabsTrigger>
          <TabsTrigger value="messages" className="text-[10px] px-2">
            Messages
          </TabsTrigger>
          <TabsTrigger value="functions" className="text-[10px] px-2">
            Functions
          </TabsTrigger>
          <TabsTrigger value="actions" className="text-[10px] px-2">
            Actions
          </TabsTrigger>
        </TabsList>

        {/* General Tab */}
        <TabsContent
          value="general"
          className="flex-1 overflow-y-auto min-h-0 space-y-4 pr-1 mt-0 pb-4"
        >
          <div className="rounded-lg border bg-neutral-50/50 dark:bg-neutral-900/30 p-3 space-y-3">
            <div>
              <label htmlFor="node-label" className="block mb-1 text-xs font-medium opacity-80">
                Label
              </label>
              <Input
                id="node-label"
                defaultValue={data?.label ?? ""}
                onBlur={(ev) => {
                  update({ label: ev.target.value });
                }}
                placeholder="Label"
                className="text-sm"
                aria-label="Node label"
              />
            </div>
            <div>
              <div className="mb-1 text-xs font-medium opacity-80">ID (auto-generated)</div>
              <div
                className="truncate font-mono text-xs text-neutral-500"
                aria-label={`Node ID: ${id}`}
              >
                {id}
              </div>
            </div>
            {displayedType && (
              <div>
                <div className="mb-1 text-xs font-medium opacity-80">Type</div>
                <div className="text-xs" aria-label={`Node type: ${displayedType}`}>
                  {displayedType}
                </div>
              </div>
            )}
            <div className="flex items-center space-x-2 pt-2 border-t border-neutral-200 dark:border-neutral-700">
              <Checkbox
                id="respond_immediately"
                checked={data?.respond_immediately !== false}
                onCheckedChange={(checked) => update({ respond_immediately: checked === true })}
                aria-label="Respond immediately"
              />
              <label
                htmlFor="respond_immediately"
                className="text-xs opacity-80 cursor-pointer leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Respond Immediately
              </label>
            </div>
          </div>
          <div className="rounded-lg border bg-neutral-50/50 dark:bg-neutral-900/30 p-3">
            <ContextStrategyForm
              contextStrategy={data?.context_strategy}
              onChange={(strategy) => update({ context_strategy: strategy })}
            />
          </div>
        </TabsContent>

        {/* Messages Tab */}
        <TabsContent
          value="messages"
          className="flex-1 overflow-y-auto min-h-0 space-y-4 pr-1 mt-0 pb-4"
        >
          {displayedType === "initial" && (
            <div className="rounded-lg border bg-neutral-50/50 dark:bg-neutral-900/30 p-3">
              <MessagesForm
                label="Role Messages"
                messages={data?.role_messages}
                onChange={(msgs) => update({ role_messages: msgs })}
              />
            </div>
          )}
          <div className="rounded-lg border bg-neutral-50/50 dark:bg-neutral-900/30 p-3">
            <MessagesForm
              label="Task Messages"
              messages={data?.task_messages}
              onChange={(msgs) => update({ task_messages: msgs })}
            />
          </div>
        </TabsContent>

        {/* Functions Tab */}
        <TabsContent value="functions" className="flex-1 overflow-y-auto min-h-0 pr-1 mt-0 pb-4">
          <div className="rounded-lg border bg-neutral-50/50 dark:bg-neutral-900/30 p-3">
            <FunctionsForm
              functions={data?.functions}
              onChange={(funcs) => update({ functions: funcs })}
              availableNodeIds={availableNodeIds}
              currentNodeId={id}
            />
          </div>
        </TabsContent>

        {/* Actions Tab */}
        <TabsContent
          value="actions"
          className="flex-1 overflow-y-auto min-h-0 space-y-4 pr-1 mt-0 pb-4"
        >
          <div className="rounded-lg border bg-neutral-50/50 dark:bg-neutral-900/30 p-3">
            <ActionsForm
              label="Pre Actions"
              actions={data?.pre_actions}
              onChange={(actions) => update({ pre_actions: actions })}
            />
          </div>
          <div className="rounded-lg border bg-neutral-50/50 dark:bg-neutral-900/30 p-3">
            <ActionsForm
              label="Post Actions"
              actions={data?.post_actions}
              onChange={(actions) => update({ post_actions: actions })}
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* JSON Toggle Section */}
      <div className="border-t border-neutral-200 dark:border-neutral-700 px-3 py-2 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-between h-8 text-xs"
          onClick={() => setShowJson(!showJson)}
          aria-label={showJson ? "Hide JSON data" : "Show JSON data"}
          aria-expanded={showJson}
        >
          <span>Data (JSON)</span>
          <div className="transition-transform duration-200">
            {showJson ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </Button>
        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out ${
            showJson ? "max-h-[500px] opacity-100 mt-2" : "max-h-0 opacity-0"
          }`}
        >
          <div className="rounded-lg border bg-neutral-50/50 dark:bg-neutral-900/30 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-xs font-medium opacity-80">JSON Data</div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] px-2"
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
                aria-label="Copy JSON data to clipboard"
              >
                Copy
              </Button>
            </div>
            <Textarea
              className="h-40 font-mono text-xs"
              value={JSON.stringify({ ...data, label: undefined }, null, 2)}
              readOnly
              aria-label="Node data in JSON format"
            />
          </div>
        </div>
      </div>
    </aside>
  );
}
