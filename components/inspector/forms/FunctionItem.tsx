"use client";

import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { FlowFunctionJson } from "@/lib/schema/flow.schema";
import { useEditorStore } from "@/lib/store/editorStore";
import { formatFunctionName, validateFunctionName } from "@/lib/utils/nameFormatting";

import { DecisionSection } from "./DecisionSection";
import { type FunctionProperty, PropertyItem } from "./PropertyItem";

interface FunctionItemProps {
  func: FlowFunctionJson;
  onChange: (updates: Partial<FlowFunctionJson>) => void;
  onRemove: () => void;
  availableNodeIds: string[];
  currentNodeId?: string;
  functionIndex: number;
  isSelected: boolean;
  selectedConditionIndex: number | null; // -1 for default, 0+ for condition index
}

export const FunctionItem = React.forwardRef<HTMLDivElement, FunctionItemProps>(
  (
    {
      func,
      onChange,
      onRemove,
      availableNodeIds,
      functionIndex,
      isSelected,
      selectedConditionIndex,
      currentNodeId,
    },
    ref
  ) => {
    // Check if next_node_id is invalid (pointing to a deleted node)
    const hasInvalidNextNode =
      func.next_node_id !== undefined && !availableNodeIds.includes(func.next_node_id);
    const [functionName, setFunctionName] = useState(func.name);
    const [nameError, setNameError] = useState<string | null>(null);
    const nameInputRef = useRef<HTMLInputElement>(null);
    const [isExpanded, setIsExpanded] = useState(isSelected);
    const defaultNextNodeRef = useRef<HTMLElement | null>(null);
    const functionNameId = useId();
    const functionDescriptionId = useId();
    const nextNodeId = useId();

    useEffect(() => {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFunctionName(func.name);
    }, [func.name]);

    const properties = useMemo(() => func.properties ?? {}, [func.properties]);
    const required = func.required ?? [];
    const propertyEntries = Object.entries(properties);

    const updateProperties = useCallback(
      (newProperties: Record<string, FunctionProperty>) => {
        onChange({
          properties: Object.keys(newProperties).length > 0 ? newProperties : undefined,
        });
      },
      [onChange]
    );

    const updateRequired = (propName: string, isRequired: boolean) => {
      const newRequired = isRequired
        ? [...required.filter((r) => r !== propName), propName]
        : required.filter((r) => r !== propName);
      onChange({ required: newRequired.length > 0 ? newRequired : undefined });
    };

    // Auto-expand function when selected
    useEffect(() => {
      if (isSelected) {
        // Use setTimeout to avoid setState in effect warning
        const timeoutId = setTimeout(() => {
          setIsExpanded(true);
        }, 0);
        return () => clearTimeout(timeoutId);
      }
    }, [isSelected]);

    const addProperty = useCallback(() => {
      const newKey = `property_${Date.now()}`;
      updateProperties({
        ...(properties as Record<string, FunctionProperty>),
        [newKey]: { type: "string" as const },
      });
    }, [properties, updateProperties]);

    const removeProperty = (propName: string) => {
      const newProperties: Record<string, FunctionProperty> = {};
      Object.entries(properties).forEach(([key, value]) => {
        if (key !== propName) {
          newProperties[key] = value as FunctionProperty;
        }
      });
      updateProperties(newProperties);
      // Also remove from required if present
      if (required.includes(propName)) {
        updateRequired(propName, false);
      }
    };

    const updateProperty = (propName: string, updates: Partial<FunctionProperty>) => {
      updateProperties({
        ...(properties as Record<string, FunctionProperty>),
        [propName]: {
          ...(properties[propName] as FunctionProperty),
          ...updates,
        } as FunctionProperty,
      });
    };

    const renameProperty = (oldName: string, newName: string) => {
      if (oldName === newName || !newName.trim()) return;
      if (properties[newName]) return; // Don't overwrite existing

      const newProperties: Record<string, FunctionProperty> = {};
      const wasRequired = required.includes(oldName);

      Object.entries(properties).forEach(([key, value]) => {
        if (key === oldName) {
          newProperties[newName] = value as FunctionProperty;
        } else {
          newProperties[key] = value as FunctionProperty;
        }
      });

      updateProperties(newProperties);

      // Update required array
      if (wasRequired) {
        const newRequired = required.filter((r) => r !== oldName);
        onChange({
          required: [...newRequired, newName].length > 0 ? [...newRequired, newName] : undefined,
        });
      }
    };

    const handleNameChange = (newName: string) => {
      // Allow raw input while typing (including spaces) - only format on blur
      setFunctionName(newName);
      setNameError(null);
    };

    const handleNameBlur = () => {
      // Format and validate on blur
      const formatted = formatFunctionName(functionName);
      const error = validateFunctionName(formatted);

      if (error) {
        setNameError(error);
      } else {
        // Update with formatted name
        setFunctionName(formatted);
        if (formatted !== func.name) {
          onChange({ name: formatted });
        }
      }
    };

    const setSelectedFunctionIndex = useEditorStore((state) => state.setSelectedFunctionIndex);

    const handleFocus = useCallback(() => {
      // Always update selection when focus enters any form element in this function
      // This ensures UI focus shifts when user tabs/clicks between functions
      // Store has guards to prevent unnecessary updates
      setSelectedFunctionIndex(functionIndex);
    }, [functionIndex, setSelectedFunctionIndex]);

    return (
      <div
        ref={ref}
        className={`rounded-lg border overflow-hidden ${
          hasInvalidNextNode
            ? "border-orange-400 dark:border-orange-500 bg-orange-50/50 dark:bg-orange-950/20"
            : "bg-white dark:bg-neutral-900"
        } ${isSelected ? "ring-2 ring-blue-500 dark:ring-blue-400" : ""}`}
      >
        {/* Collapsible Header */}
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

        {/* Collapsible Content */}
        <div
          className={`overflow-hidden transition-all duration-200 ease-in-out ${
            isExpanded ? "max-h-[5000px] opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <div className="p-4 space-y-4">
            {/* Basic Info Section */}
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor={functionNameId} className="text-xs opacity-60">
                  Function name
                </label>
                <Input
                  ref={nameInputRef}
                  id={functionNameId}
                  className={`h-8 text-xs ${nameError ? "border-red-500" : ""}`}
                  value={functionName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  onFocus={handleFocus}
                  onBlur={handleNameBlur}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.currentTarget.blur();
                    }
                  }}
                  placeholder="e.g., choose_pizza"
                />
                {nameError && <div className="mt-1 text-xs text-red-600">{nameError}</div>}
              </div>
              <div className="space-y-2">
                <label htmlFor={functionDescriptionId} className="text-xs opacity-60">
                  Description
                </label>
                <Textarea
                  id={functionDescriptionId}
                  className="min-h-20 text-xs"
                  value={func.description}
                  onChange={(e) => onChange({ description: e.target.value })}
                  onFocus={handleFocus}
                  placeholder="Describe what this function does"
                />
              </div>
            </div>

            {/* Properties Section */}
            <div className="pt-3 border-t border-neutral-200 dark:border-neutral-700">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-medium opacity-80">Properties</div>
                <Button variant="ghost" size="sm" className="h-6 gap-1" onClick={addProperty}>
                  <Plus className="h-4 w-4" /> Add Property
                </Button>
              </div>
              {propertyEntries.length === 0 ? (
                <div className="text-xs opacity-40 italic py-2">
                  No properties. Click "Add Property" to create one.
                </div>
              ) : (
                <div className="space-y-2">
                  {propertyEntries.map(([propName, prop]) => (
                    <PropertyItem
                      key={propName}
                      propName={propName}
                      property={prop as FunctionProperty}
                      isRequired={required.includes(propName)}
                      onUpdate={(updates) => updateProperty(propName, updates)}
                      onRename={(newName) => renameProperty(propName, newName)}
                      onRemove={() => removeProperty(propName)}
                      onRequiredChange={(isReq) => updateRequired(propName, isReq)}
                      onFocus={handleFocus}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Next Node Section */}
            <div className="pt-3 border-t border-neutral-200 dark:border-neutral-700">
              <div className="mb-2 flex items-center justify-between">
                <label
                  ref={(el) => {
                    defaultNextNodeRef.current = el;
                  }}
                  htmlFor={nextNodeId}
                  className="text-xs font-medium opacity-80 flex items-center gap-1"
                >
                  {func.decision ? "Default Next Node" : "Next Node"}
                  {hasInvalidNextNode && (
                    <span
                      className="text-orange-600 dark:text-orange-400 text-xs"
                      title="Invalid: target node was deleted"
                    >
                      ⚠
                    </span>
                  )}
                </label>
                {func.next_node_id && !func.decision && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs px-2"
                    onClick={() => onChange({ next_node_id: undefined })}
                  >
                    Clear
                  </Button>
                )}
              </div>
              {hasInvalidNextNode && (
                <div className="mb-2 text-xs text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-950/40 px-2 py-1 rounded">
                  Invalid: Target node "{func.next_node_id}" was deleted
                </div>
              )}
              {availableNodeIds.length > 0 ? (
                <Select
                  value={
                    func.decision
                      ? func.decision.default_next_node_id
                      : (func.next_node_id ?? undefined)
                  }
                  onValueChange={(v) => {
                    if (func.decision) {
                      onChange({
                        decision: {
                          ...func.decision,
                          default_next_node_id: v,
                        },
                      });
                    } else {
                      onChange({ next_node_id: v });
                    }
                  }}
                  onOpenChange={(open) => {
                    if (open) {
                      handleFocus();
                    }
                  }}
                >
                  <SelectTrigger
                    id={nextNodeId}
                    className={`h-8 text-xs ${hasInvalidNextNode ? "border-orange-400 dark:border-orange-500" : ""}`}
                    onFocus={handleFocus}
                  >
                    <SelectValue placeholder="Select next node..." />
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
                <div className="text-xs opacity-40 italic py-1">No other nodes available</div>
              )}
            </div>

            {/* Decision Section */}
            <DecisionSection
              func={func}
              onChange={onChange}
              availableNodeIds={availableNodeIds}
              currentNodeId={currentNodeId}
              functionIndex={functionIndex}
              isSelected={isSelected}
              selectedConditionIndex={selectedConditionIndex}
              onFocus={handleFocus}
            />
          </div>
        </div>
      </div>
    );
  }
);

FunctionItem.displayName = "FunctionItem";
