"use client";

import { Copy, PanelRightClose, Plus } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { showToast } from "@/components/ui/Toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { canvasToConfig } from "@/lib/convert/canvasToConfig";
import type { CanvasNode } from "@/lib/convert/configToCanvas";
import { DEFAULT_FLOW_NAME, FLOW_FILE_EXTENSION } from "@/lib/document/flowDocument";
import {
  actionHandlers,
  GLOBAL_SCOPE,
  type NameReference,
  referencedTools,
  templateVariables,
} from "@/lib/document/flowIntrospection";
import type { FlowConfigFunction } from "@/lib/schema/flowConfig";
import { useFlowStore } from "@/lib/store/flowStore";
import { checkFlowConfigReferences, checkFlowGraph } from "@/lib/validation/flowConfigValidator";

import { FunctionItem } from "./forms/FunctionItem";

type Props = {
  nodes: CanvasNode[];
  onCollapse: () => void;
};

/**
 * The flow beyond its nodes: the file name, the global functions, and what
 * the config asks of the code: the tools and handlers the tools module must
 * define and the variables the Flow must be given.
 */
export default function FlowPanel({ nodes, onCollapse }: Props) {
  const flowName = useFlowStore((state) => state.flowName);
  const setFlowName = useFlowStore((state) => state.setFlowName);
  const globalFunctions = useFlowStore((state) => state.globalFunctions);
  const setGlobalFunctions = useFlowStore((state) => state.setGlobalFunctions);
  const nameId = useId();
  const [selectedGlobal, setSelectedGlobal] = useState<number | null>(null);

  const availableNodeIds = nodes.map((n) => n.id);
  const config = canvasToConfig(nodes, globalFunctions);
  const tools = referencedTools(config);
  const handlers = actionHandlers(config);
  const variables = templateVariables(config);
  const references = checkFlowConfigReferences(config);
  const issues = references.length > 0 ? references : checkFlowGraph(config);

  const updateGlobal = (index: number, updates: Partial<FlowConfigFunction>) => {
    setGlobalFunctions(globalFunctions.map((fn, i) => (i === index ? { ...fn, ...updates } : fn)));
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="mb-2 flex items-center justify-between px-3 pt-3 text-xs font-semibold uppercase opacity-70 shrink-0">
        <span>Flow</span>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={onCollapse}
                aria-label="Hide the sidebar"
              >
                <PanelRightClose className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Hide the sidebar</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 space-y-4 px-3 pb-4">
        <section className="rounded-lg border bg-neutral-50/50 dark:bg-neutral-900/30 p-3 space-y-2">
          <label htmlFor={nameId} className="block text-xs font-medium opacity-80">
            Name
          </label>
          <div className="flex items-center gap-1">
            <Input
              id={nameId}
              className="text-sm font-mono"
              defaultValue={flowName}
              key={flowName}
              onBlur={(e) => setFlowName(e.target.value.trim() || DEFAULT_FLOW_NAME)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              aria-label="Flow name"
            />
            <span className="text-xs opacity-60">{FLOW_FILE_EXTENSION}</span>
          </div>
          <div className="text-[11px] opacity-50">The file the flow saves as.</div>
        </section>

        <section className="rounded-lg border bg-neutral-50/50 dark:bg-neutral-900/30 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium opacity-80">Global functions</div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1"
              onClick={() => {
                setGlobalFunctions([...globalFunctions, { name: "" }]);
                setSelectedGlobal(globalFunctions.length);
              }}
            >
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>
          <div className="text-[11px] opacity-50">Tools offered at every node.</div>
          {globalFunctions.map((fn, i) => (
            <div key={i} onFocusCapture={() => setSelectedGlobal(i)}>
              <FunctionItem
                func={fn}
                onChange={(updates) => updateGlobal(i, updates)}
                onRemove={() => {
                  setGlobalFunctions(globalFunctions.filter((_, j) => j !== i));
                  setSelectedGlobal(null);
                }}
                availableNodeIds={availableNodeIds}
                functionIndex={i}
                isSelected={selectedGlobal === i}
                selectedConditionIndex={null}
              />
            </div>
          ))}
          {globalFunctions.length === 0 && (
            <div className="text-xs opacity-40 italic py-2">No global functions.</div>
          )}
        </section>

        <section className="rounded-lg border bg-neutral-50/50 dark:bg-neutral-900/30 p-3 space-y-2">
          <div className="text-xs font-medium opacity-80">
            Issues
            {issues.length > 0 && <span className="ml-1 opacity-60">· {issues.length}</span>}
          </div>
          <div className="text-[11px] opacity-50">
            What Pipecat would report for this config. Errors keep it from loading; warnings do not.
          </div>
          {issues.length === 0 ? (
            <div className="text-xs opacity-40 italic py-1">No issues.</div>
          ) : (
            <ul className="space-y-1">
              {issues.map((issue, i) => (
                <li key={i} className="flex items-baseline gap-2 text-xs">
                  <span
                    className={`shrink-0 font-mono text-[10px] uppercase ${
                      issue.level === "error"
                        ? "text-red-600 dark:text-red-400"
                        : "text-orange-600 dark:text-orange-400"
                    }`}
                  >
                    {issue.level}
                  </span>
                  <span className="min-w-0">{issue.message}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <ReferenceList
          title="Referenced tools"
          description="Direct functions the tools module must define."
          empty="No tools referenced yet."
          items={tools}
        />
        <ReferenceList
          title="Action handlers"
          description="Handlers for function actions, from the same tools module."
          empty="No function actions."
          items={handlers}
        />
        <ReferenceList
          title="Variables"
          description="Placeholders in messages and action text, supplied when the Flow is constructed."
          empty="No {{ variables }} used."
          items={variables}
        />
      </div>
    </div>
  );
}

function ReferenceList({
  title,
  description,
  empty,
  items,
}: {
  title: string;
  description: string;
  empty: string;
  items: NameReference[];
}) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(items.map((item) => item.name).join("\n"));
      showToast("Copied to clipboard", "success");
    } catch (err) {
      console.warn(err);
      showToast("Failed to copy to clipboard", "error");
    }
  };

  return (
    <section className="rounded-lg border bg-neutral-50/50 dark:bg-neutral-900/30 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium opacity-80">
          {title}
          {items.length > 0 && <span className="ml-1 opacity-60">· {items.length}</span>}
        </div>
        {items.length > 0 && (
          <Button variant="ghost" size="sm" className="h-6 gap-1 text-[10px]" onClick={copy}>
            <Copy className="h-3 w-3" /> Copy
          </Button>
        )}
      </div>
      <div className="text-[11px] opacity-50">{description}</div>
      {items.length === 0 ? (
        <div className="text-xs opacity-40 italic py-1">{empty}</div>
      ) : (
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item.name} className="flex items-baseline justify-between gap-2 text-xs">
              <code className="font-mono">{item.name}</code>
              <span className="opacity-50 truncate text-[11px]">
                {item.usedBy.map((scope) => (scope === GLOBAL_SCOPE ? "global" : scope)).join(", ")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
