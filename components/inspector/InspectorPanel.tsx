"use client";

import { ChevronDown, ChevronUp, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { stringify } from "yaml";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { showToast } from "@/components/ui/Toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { configNodeFromData } from "@/lib/convert/canvasToConfig";
import { type CanvasNode, type ConfigNodeData, isConfigNode } from "@/lib/convert/configToCanvas";
import { useEditorStore } from "@/lib/store/editorStore";
import { generateNodeIdFromLabel } from "@/lib/utils/nodeId";

import FlowPanel from "./FlowPanel";
import ActionsForm from "./forms/ActionsForm";
import ContextStrategyForm from "./forms/ContextStrategyForm";
import FunctionsForm from "./forms/FunctionsForm";
import MessagesForm from "./forms/MessagesForm";

type Props = {
  nodes: CanvasNode[];
  onChange: (next: { id: string; data: ConfigNodeData }) => void;
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
  const inspectorPanelWidth = useEditorStore((state) => state.inspectorPanelWidth);
  const setInspectorPanelWidth = useEditorStore((state) => state.setInspectorPanelWidth);
  const setIsInspectorResizing = useEditorStore((state) => state.setIsInspectorResizing);
  const selectNode = useEditorStore((state) => state.selectNode);
  const rfInstance = useEditorStore((state) => state.rfInstance);
  const showFlowPanel = useEditorStore((state) => state.showFlowPanel);
  const setShowFlowPanel = useEditorStore((state) => state.setShowFlowPanel);

  const found = selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) : undefined;
  const selected = found && isConfigNode(found) ? found : null;
  const id = selected?.id;
  const data = selected?.data;
  const displayedType = selected?.type;

  const labelInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!labelInputRef.current) return;
    labelInputRef.current.value = data?.label ?? "";
  }, [data?.label]);

  const [showYaml, setShowYaml] = useState(false);

  const update = useCallback(
    (partial: Partial<ConfigNodeData>) => {
      if (!selected || !id || !data) return;
      onChange({ id, data: { ...data, ...partial } });
    },
    [selected, id, data, onChange]
  );

  // The node's name is its key in the config. Renaming rewrites every
  // destination that pointed at it.
  const rename = useCallback(
    (name: string) => {
      if (!id || !name.trim()) return;
      const otherNodeIds = availableNodeIds.filter((nodeId) => nodeId !== id);
      const newId = generateNodeIdFromLabel(name, otherNodeIds);
      if (newId !== id) onRenameNode?.(id, newId);
    },
    [id, onRenameNode, availableNodeIds]
  );

  // Resize handle handler
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsInspectorResizing(true);
    const startX = e.clientX;
    const startWidth = inspectorPanelWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = startX - moveEvent.clientX; // Inverted because we're dragging left
      // Limit max width to viewport width minus some padding
      const maxWidth = Math.min(800, window.innerWidth - 32);
      const newWidth = Math.max(280, Math.min(maxWidth, startWidth + delta));
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

  const [activeTab, setActiveTab] = useState<string>(
    selectedFunctionIndex !== null ? "functions" : "general"
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveTab(selectedFunctionIndex !== null ? "functions" : "general");
  }, [selectedFunctionIndex]);

  // Early return after all hooks
  if (!selected) {
    return (
      <aside
        className="relative shrink-0 border-l bg-white/70 backdrop-blur dark:bg-black/40 flex flex-col overflow-hidden h-full max-w-full"
        style={{ width: `${inspectorPanelWidth}px`, maxWidth: "min(100vw, 800px)" }}
      >
        <div
          className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-blue-500 bg-transparent z-20"
          onMouseDown={handleResizeStart}
          aria-label="Resize inspector panel"
          role="separator"
          aria-orientation="vertical"
        />
        {showFlowPanel ? (
          <FlowPanel nodes={nodes} onClose={() => setShowFlowPanel(false)} />
        ) : (
          <div className="p-3 text-sm">
            <div className="opacity-60">Select a node or edge</div>
          </div>
        )}
      </aside>
    );
  }

  const nodeYaml = stringify({ [selected.id]: configNodeFromData(selected.data) });

  return (
    <aside
      className="relative z-20 shrink-0 border-l bg-white/70 backdrop-blur dark:bg-black/40 flex flex-col overflow-hidden h-full max-w-full"
      style={{ width: `${inspectorPanelWidth}px`, maxWidth: "min(100vw, 800px)" }}
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
        <span className="truncate flex-1 min-w-0">
          Inspector: <code className="text-xs font-mono lowercase">{id}</code>
        </span>
        <div className="flex items-center gap-1 shrink-0">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 sm:hidden"
                  onClick={(e) => {
                    e.stopPropagation();
                    selectNode(null);
                    rfInstance?.setNodes((nds) =>
                      nds.map((node) => ({
                        ...node,
                        selected: false,
                      }))
                    );
                  }}
                  aria-label="Close inspector"
                >
                  <X className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Close inspector</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => onDelete(id as string, "node")}
                  disabled={displayedType === "initial"}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                {displayedType === "initial"
                  ? "The initial node cannot be deleted; make another node initial first"
                  : "Delete node"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

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

        <TabsContent
          value="general"
          className="flex-1 overflow-y-auto min-h-0 space-y-4 pr-1 mt-0 pb-4"
        >
          <div className="rounded-lg border bg-neutral-50/50 dark:bg-neutral-900/30 p-3 space-y-3">
            <div>
              <label htmlFor="node-label" className="block mb-1 text-xs font-medium opacity-80">
                Name
              </label>
              <Input
                ref={labelInputRef}
                id="node-label"
                defaultValue={data?.label ?? ""}
                onBlur={(ev) => rename(ev.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
                placeholder="node_name"
                className="text-sm font-mono"
                aria-label="Node name"
              />
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
              value={data?.context_strategy}
              onChange={(strategy) => update({ context_strategy: strategy })}
            />
          </div>
        </TabsContent>

        <TabsContent
          value="messages"
          className="flex-1 overflow-y-auto min-h-0 space-y-4 pr-1 mt-0 pb-4"
        >
          <div className="rounded-lg border bg-neutral-50/50 dark:bg-neutral-900/30 p-3 space-y-2">
            <label htmlFor="node-role-message" className="block text-xs opacity-60">
              Role Message
            </label>
            <Textarea
              id="node-role-message"
              className="min-h-20 text-xs"
              value={data?.role_message ?? ""}
              onChange={(e) => update({ role_message: e.target.value || undefined })}
              placeholder="The bot's role or personality, sent as the system instruction on entering this node"
            />
            <div className="text-[11px] opacity-50">
              Persists across transitions until another node sets its own. Setting it on the initial
              node covers the whole flow.
            </div>
          </div>
          <div className="rounded-lg border bg-neutral-50/50 dark:bg-neutral-900/30 p-3">
            <MessagesForm
              label="Task Messages"
              messages={data?.task_messages}
              onChange={(msgs) => update({ task_messages: msgs })}
            />
          </div>
        </TabsContent>

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

      <div className="border-t border-neutral-200 dark:border-neutral-700 px-3 py-2 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-between h-8 text-xs"
          onClick={() => setShowYaml(!showYaml)}
          aria-label={showYaml ? "Hide YAML" : "Show YAML"}
          aria-expanded={showYaml}
        >
          <span>Node YAML</span>
          <div className="transition-transform duration-200">
            {showYaml ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </Button>
        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out ${
            showYaml ? "max-h-[500px] opacity-100 mt-2" : "max-h-0 opacity-0"
          }`}
        >
          <div className="rounded-lg border bg-neutral-50/50 dark:bg-neutral-900/30 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-xs font-medium opacity-80">
                <code>{id}</code> as YAML
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] px-2"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(nodeYaml);
                    showToast("Copied to clipboard", "success");
                  } catch (err) {
                    console.warn(err);
                    showToast("Failed to copy to clipboard", "error");
                  }
                }}
                title="Copy to clipboard"
                aria-label="Copy node YAML to clipboard"
              >
                Copy
              </Button>
            </div>
            <Textarea
              className="h-40 font-mono text-xs"
              value={nodeYaml}
              readOnly
              aria-label="Node as YAML"
            />
          </div>
        </div>
      </div>
    </aside>
  );
}
