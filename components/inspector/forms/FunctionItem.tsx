"use client";

import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import React, { useCallback, useEffect, useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  type FlowConfigBranch,
  type FlowConfigFunction,
  functionTargets,
  isBranch,
} from "@/lib/schema/flowConfig";
import { useEditorStore } from "@/lib/store/editorStore";
import { formatFunctionName, validateFunctionName } from "@/lib/utils/nameFormatting";

import BranchEditor from "./BranchEditor";

interface FunctionItemProps {
  func: FlowConfigFunction;
  onChange: (updates: Partial<FlowConfigFunction>) => void;
  onRemove: () => void;
  availableNodeIds: string[];
  currentNodeId?: string;
  functionIndex: number;
  isSelected: boolean;
  selectedConditionIndex: number | null; // -1 for the branch default, 0+ for a case index
}

/**
 * A function entry: a tool name and where it leads. The tool's description
 * and parameters live in the Python tools module, not here.
 */
export const FunctionItem = React.forwardRef<HTMLDivElement, FunctionItemProps>(
  (
    {
      func,
      onChange,
      onRemove,
      availableNodeIds,
      currentNodeId,
      functionIndex,
      isSelected,
      selectedConditionIndex,
    },
    ref
  ) => {
    const missingTargets = functionTargets(func).filter((t) => !availableNodeIds.includes(t));
    const hasInvalidTarget = missingTargets.length > 0;
    const [functionName, setFunctionName] = useState(func.name);
    const [nameError, setNameError] = useState<string | null>(null);
    const [isExpanded, setIsExpanded] = useState(isSelected);
    const functionNameId = useId();
    const destinationId = useId();

    useEffect(() => {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFunctionName(func.name);
    }, [func.name]);

    // Auto-expand function when selected
    useEffect(() => {
      if (isSelected) {
        const timeoutId = setTimeout(() => setIsExpanded(true), 0);
        return () => clearTimeout(timeoutId);
      }
    }, [isSelected]);

    const handleNameBlur = () => {
      const formatted = formatFunctionName(functionName);
      const error = validateFunctionName(formatted);
      if (error) {
        setNameError(error);
        return;
      }
      setFunctionName(formatted);
      if (formatted !== func.name) onChange({ name: formatted });
    };

    const setSelectedFunctionIndex = useEditorStore((state) => state.setSelectedFunctionIndex);
    const handleFocus = useCallback(() => {
      setSelectedFunctionIndex(functionIndex);
    }, [functionIndex, setSelectedFunctionIndex]);

    const transition = func.transition_to;
    const branch = isBranch(transition) ? transition : null;
    const destination = typeof transition === "string" ? transition : undefined;

    // Switching modes keeps the destination: a branch starts with one case
    // leading where the node destination did, and back again the default or
    // first case becomes the node destination.
    const switchToBranch = () => {
      const target = destination ?? currentNodeId ?? availableNodeIds[0] ?? "";
      const next: FlowConfigBranch = { field: "", cases: { value_1: target } };
      onChange({ transition_to: next });
    };
    const switchToNode = () => {
      if (!branch) return;
      const target = branch.default ?? Object.values(branch.cases)[0];
      onChange({ transition_to: target });
    };

    return (
      <div
        ref={ref}
        className={`rounded-lg border overflow-hidden ${
          hasInvalidTarget
            ? "border-orange-400 dark:border-orange-500 bg-orange-50/50 dark:bg-orange-950/20"
            : "bg-white dark:bg-neutral-900"
        } ${isSelected ? "ring-2 ring-blue-500 dark:ring-blue-400" : ""}`}
      >
        <div className="flex items-center gap-2 p-3">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 flex-1 min-w-0 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors -ml-1 -mr-1 px-1 py-1 rounded"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 opacity-60 shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 opacity-60 shrink-0" />
            )}
            <span className="text-xs font-medium truncate">
              {functionName || func.name || `Function ${functionIndex + 1}`}
            </span>
          </button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove();
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Remove function</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div
          className={`overflow-hidden transition-all duration-200 ease-in-out ${
            isExpanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <div className="p-4 space-y-4">
            <div className="space-y-2">
              <label htmlFor={functionNameId} className="text-xs opacity-60">
                Tool name
              </label>
              <Input
                id={functionNameId}
                className={`h-8 text-xs ${nameError ? "border-red-500" : ""}`}
                value={functionName}
                onChange={(e) => {
                  setFunctionName(e.target.value);
                  setNameError(null);
                }}
                onFocus={handleFocus}
                onBlur={handleNameBlur}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
                placeholder="e.g., choose_pizza"
              />
              {nameError && <div className="mt-1 text-xs text-red-600">{nameError}</div>}
              <div className="text-[11px] opacity-50">
                A direct function in the tools module. Its description and parameters come from the
                code.
              </div>
            </div>

            <div className="pt-3 border-t border-neutral-200 dark:border-neutral-700">
              <div className="mb-2 flex items-center justify-between">
                <label
                  htmlFor={destinationId}
                  className="text-xs font-medium opacity-80 flex items-center gap-1"
                >
                  Transition to
                  {hasInvalidTarget && (
                    <span
                      className="text-orange-600 dark:text-orange-400 text-xs"
                      title="Invalid: target node was deleted"
                    >
                      ⚠
                    </span>
                  )}
                </label>
                {transition !== undefined && transition !== null && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs px-2"
                    onClick={() => onChange({ transition_to: undefined })}
                  >
                    Clear
                  </Button>
                )}
              </div>
              {hasInvalidTarget && (
                <div className="mb-2 text-xs text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-950/40 px-2 py-1 rounded">
                  Invalid: no node named {missingTargets.map((t) => `"${t}"`).join(", ")}
                </div>
              )}
              <div
                className="mb-2 inline-flex rounded-md border text-xs overflow-hidden"
                role="radiogroup"
                aria-label="Destination kind"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={!branch}
                  className={`px-2 py-1 ${!branch ? "bg-neutral-200 dark:bg-neutral-700" : "opacity-70"}`}
                  onClick={() => branch && switchToNode()}
                >
                  A node
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={Boolean(branch)}
                  className={`px-2 py-1 border-l ${branch ? "bg-neutral-200 dark:bg-neutral-700" : "opacity-70"}`}
                  onClick={() => !branch && switchToBranch()}
                >
                  Branch on the result
                </button>
              </div>
              {branch ? (
                <BranchEditor
                  branch={branch}
                  onChange={(next) => onChange({ transition_to: next })}
                  availableNodeIds={availableNodeIds}
                  currentNodeId={currentNodeId}
                  selectedConditionIndex={selectedConditionIndex}
                  onFocus={handleFocus}
                />
              ) : availableNodeIds.length > 0 ? (
                <Select
                  value={destination}
                  onValueChange={(v) => onChange({ transition_to: v })}
                  onOpenChange={(open) => {
                    if (open) handleFocus();
                  }}
                >
                  <SelectTrigger
                    id={destinationId}
                    className={`h-8 text-xs ${hasInvalidTarget ? "border-orange-400 dark:border-orange-500" : ""}`}
                    onFocus={handleFocus}
                  >
                    <SelectValue placeholder="Stay on this node" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableNodeIds.map((nodeId) => (
                      <SelectItem key={nodeId} value={nodeId}>
                        {nodeId}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="text-xs opacity-40 italic py-1">No nodes available</div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
);

FunctionItem.displayName = "FunctionItem";
