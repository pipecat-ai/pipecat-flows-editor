"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { DecisionConditionJson, FlowFunctionJson } from "@/lib/schema/flow.schema";
import { useEditorStore } from "@/lib/store/editorStore";

/**
 * Generate a Python-safe function name from input
 * Converts to lowercase, replaces spaces and invalid chars with underscores,
 * ensures it doesn't start with a number
 */
function formatFunctionName(input: string): string {
  if (!input || input.trim() === "") {
    return "";
  }

  // Convert to lowercase, replace spaces and invalid chars with underscores
  let formatted = input
    .toLowerCase()
    .replace(/\s+/g, "_") // Convert spaces (and multiple spaces) to underscores
    .replace(/[^a-z0-9_]/g, "_") // Replace any other invalid chars with underscores
    .replace(/_+/g, "_") // Collapse multiple underscores
    .replace(/^_+|_+$/g, ""); // Remove leading/trailing underscores

  // Ensure it doesn't start with a number
  if (/^[0-9]/.test(formatted)) {
    formatted = `func_${formatted}`;
  }

  return formatted;
}

/**
 * Validate that a function name is a valid Python identifier
 */
function validateFunctionName(name: string): string | null {
  if (!name || name.trim() === "") {
    return "Function name cannot be empty";
  }

  const trimmed = name.trim();

  // Must be valid Python identifier (lowercase, numbers, underscores, no leading number)
  if (!/^[a-z][a-z0-9_]*$/.test(trimmed)) {
    return "Function name must start with a letter and contain only lowercase letters, numbers, and underscores";
  }

  return null;
}

/**
 * Format a property name to be Python-safe (same as function name formatting)
 */
function formatPropertyName(input: string): string {
  return formatFunctionName(input);
}

/**
 * Validate that a property name is a valid Python identifier
 */
function validatePropertyName(name: string): string | null {
  return validateFunctionName(name);
}

type FunctionProperty = {
  type: "string" | "integer" | "number" | "boolean";
  description?: string;
  enum?: string[];
  minimum?: number;
  maximum?: number;
};

type Props = {
  functions: FlowFunctionJson[] | undefined;
  onChange: (functions: FlowFunctionJson[]) => void;
  availableNodeIds: string[];
  currentNodeId?: string;
};

export default function FunctionsForm({
  functions,
  onChange,
  availableNodeIds,
  currentNodeId,
}: Props) {
  const items = functions ?? [];
  const functionRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);
  const selectedFunctionIndex = useEditorStore((state) => state.selectedFunctionIndex);
  const selectedConditionIndex = useEditorStore((state) => state.selectedConditionIndex);
  const scrollTarget = useEditorStore((state) => state.scrollTarget);
  const setScrollTarget = useEditorStore((state) => state.setScrollTarget);

  // Derive highlighted function index from store for scroll-into-view
  const highlightedFunctionIndex = selectedNodeId === currentNodeId ? selectedFunctionIndex : null;

  const updateItem = (index: number, updates: Partial<FlowFunctionJson>) => {
    const next = [...items];
    next[index] = { ...next[index], ...updates };
    onChange(next);
  };

  const addItem = () => {
    onChange([...items, { name: "", description: "" }]);
  };

  const removeItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    onChange(newItems);
    // Notify parent to adjust selectedFunctionIndex if needed
    // This will be handled by the parent component through the onChange callback
  };

  // Check if we should scroll to a function based on scroll target
  useEffect(() => {
    if (
      scrollTarget &&
      scrollTarget.nodeId === currentNodeId &&
      scrollTarget.functionIndex !== null &&
      scrollTarget.functionIndex === highlightedFunctionIndex
    ) {
      // Scroll target matches this form - scroll to the function
      const element = functionRefs.current.get(scrollTarget.functionIndex);
      if (element) {
        // Use requestAnimationFrame to ensure DOM is ready
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            element.scrollIntoView({ behavior: "smooth", block: "nearest" });
            // Clear scroll target after scrolling
            setScrollTarget(null);
          });
        });
      } else {
        // Element not found yet, try again after a delay
        const timeoutId = setTimeout(() => {
          if (scrollTarget.functionIndex !== null) {
            const retryElement = functionRefs.current.get(scrollTarget.functionIndex);
            if (retryElement) {
              retryElement.scrollIntoView({ behavior: "smooth", block: "nearest" });
              setScrollTarget(null);
            }
          }
        }, 100);
        return () => clearTimeout(timeoutId);
      }
    }
  }, [scrollTarget, currentNodeId, highlightedFunctionIndex, setScrollTarget]);

  const setFunctionRef = (index: number, element: HTMLDivElement | null) => {
    if (element) {
      functionRefs.current.set(index, element);
    } else {
      functionRefs.current.delete(index);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-[11px] opacity-60">Functions</div>
        <Button variant="ghost" size="sm" className="h-5 text-xs px-2" onClick={addItem}>
          + Add
        </Button>
      </div>
      {items.map((func, i) => (
        <FunctionItem
          key={i}
          ref={(el) => setFunctionRef(i, el)}
          func={func}
          onChange={(updates) => updateItem(i, updates)}
          onRemove={() => removeItem(i)}
          availableNodeIds={availableNodeIds}
          currentNodeId={currentNodeId}
          functionIndex={i}
          selectedConditionIndex={
            selectedNodeId === currentNodeId && selectedFunctionIndex === i
              ? selectedConditionIndex
              : null
          }
        />
      ))}
      {items.length === 0 && (
        <div className="text-[11px] opacity-40 italic">
          No functions. Click "+ Add" to create one.
        </div>
      )}
    </div>
  );
}

interface FunctionItemProps {
  func: FlowFunctionJson;
  onChange: (updates: Partial<FlowFunctionJson>) => void;
  onRemove: () => void;
  availableNodeIds: string[];
  currentNodeId?: string;
  functionIndex: number;
  selectedConditionIndex: number | null; // -1 for default, 0+ for condition index
}

const FunctionItem = React.forwardRef<HTMLDivElement, FunctionItemProps>(
  (
    {
      func,
      onChange,
      onRemove,
      availableNodeIds,
      functionIndex,
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
    const [showDecision, setShowDecision] = useState(func.decision !== undefined);
    const conditionRefs = useRef<Map<number, HTMLDivElement>>(new Map());
    const defaultNextNodeRef = useRef<HTMLElement | null>(null);
    const scrollTarget = useEditorStore((state) => state.scrollTarget);
    const setScrollTarget = useEditorStore((state) => state.setScrollTarget);

    // Removed auto-focus - selectedFunctionIndex should only control highlighting
    // Focus should be managed by user interaction (tabbing, clicking)
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

    // Ensure decision section is expanded when a condition is selected or scroll target requires it
    const needsExpansion =
      (selectedConditionIndex !== null || (scrollTarget && scrollTarget.conditionIndex !== null)) &&
      func.decision &&
      !showDecision;

    useEffect(() => {
      if (needsExpansion) {
        // Use setTimeout to avoid setState in effect warning
        const timeoutId = setTimeout(() => {
          setShowDecision(true);
        }, 0);
        return () => clearTimeout(timeoutId);
      }
    }, [needsExpansion]);

    // Check if we should scroll to a condition based on scroll target
    useEffect(() => {
      if (
        scrollTarget &&
        currentNodeId &&
        scrollTarget.nodeId === currentNodeId &&
        scrollTarget.functionIndex === functionIndex &&
        scrollTarget.conditionIndex !== null
      ) {
        // Wait for decision section to expand if needed
        const delay = showDecision ? 50 : 150;
        const timeoutId = setTimeout(() => {
          const conditionIndex = scrollTarget.conditionIndex;
          if (conditionIndex === -1) {
            // Scroll to default next node
            if (defaultNextNodeRef.current) {
              defaultNextNodeRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
              setScrollTarget(null);
            }
          } else if (conditionIndex !== null && conditionIndex >= 0) {
            // Scroll to specific condition
            const element = conditionRefs.current.get(conditionIndex);
            if (element) {
              element.scrollIntoView({ behavior: "smooth", block: "nearest" });
              setScrollTarget(null);
            } else {
              // Element not found yet, try again
              const retryTimeoutId = setTimeout(() => {
                const retryElement = conditionRefs.current.get(conditionIndex);
                if (retryElement) {
                  retryElement.scrollIntoView({ behavior: "smooth", block: "nearest" });
                  setScrollTarget(null);
                }
              }, 100);
              return () => clearTimeout(retryTimeoutId);
            }
          }
        }, delay);

        return () => clearTimeout(timeoutId);
      }
    }, [scrollTarget, currentNodeId, functionIndex, showDecision, func.decision, setScrollTarget]);

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
        className={`space-y-2 rounded border p-2 ${
          hasInvalidNextNode
            ? "border-orange-400 dark:border-orange-500 bg-orange-50/50 dark:bg-orange-950/20"
            : ""
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <Input
              ref={nameInputRef}
              className={`h-6 text-xs flex-1 ${nameError ? "border-red-500" : ""}`}
              value={functionName}
              onChange={(e) => handleNameChange(e.target.value)}
              onFocus={handleFocus}
              onBlur={handleNameBlur}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.currentTarget.blur();
                }
              }}
              placeholder="Function name (e.g., choose_pizza)"
            />
            {nameError && <div className="mt-0.5 text-[9px] text-red-600">{nameError}</div>}
          </div>
          <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={onRemove}>
            ×
          </Button>
        </div>
        <Textarea
          className="h-16 text-xs"
          value={func.description}
          onChange={(e) => onChange({ description: e.target.value })}
          onFocus={handleFocus}
          placeholder="Function description"
        />
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="text-[10px] opacity-60">Properties</div>
            <Button variant="ghost" size="sm" className="h-4 text-[9px] px-2" onClick={addProperty}>
              + Add Property
            </Button>
          </div>
          {propertyEntries.length === 0 ? (
            <div className="text-[10px] opacity-40 italic py-1">
              No properties. Click "+ Add Property" to create one.
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
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span
              ref={(el) => {
                defaultNextNodeRef.current = el;
              }}
              className="text-[10px] opacity-60 flex items-center gap-1"
            >
              {func.decision ? "Default Next Node" : "Next Node"}
              {hasInvalidNextNode && (
                <span
                  className="text-orange-600 dark:text-orange-400 text-[9px]"
                  title="Invalid: target node was deleted"
                >
                  ⚠
                </span>
              )}
            </span>
            {func.next_node_id && !func.decision && (
              <Button
                variant="ghost"
                size="sm"
                className="h-4 text-[9px] px-1"
                onClick={() => onChange({ next_node_id: undefined })}
              >
                Clear
              </Button>
            )}
          </div>
          {hasInvalidNextNode && (
            <div className="mb-1 text-[9px] text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-950/40 px-1.5 py-0.5 rounded">
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
                className={`h-6 text-xs ${hasInvalidNextNode ? "border-orange-400 dark:border-orange-500" : ""}`}
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
            <div className="text-[10px] opacity-40 italic">No other nodes available</div>
          )}
        </div>

        {/* Decision Section */}
        <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-700">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                if (!func.decision) {
                  // Create decision with current next_node_id as default
                  onChange({
                    decision: {
                      action: "",
                      conditions: [],
                      default_next_node_id: func.next_node_id || "",
                    },
                  });
                  setShowDecision(true);
                } else {
                  setShowDecision(!showDecision);
                }
              }}
              className="flex items-center gap-1 text-[10px] opacity-60 hover:opacity-100"
            >
              {showDecision ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              Decision
            </button>
            {func.decision && (
              <Button
                variant="ghost"
                size="sm"
                className="h-4 text-[9px] px-1"
                onClick={() => {
                  onChange({ decision: undefined });
                  setShowDecision(false);
                }}
              >
                Remove
              </Button>
            )}
          </div>
          {func.decision && showDecision && (
            <div className="space-y-3">
              {/* Action Input */}
              <div>
                <div className="mb-1 text-[10px] opacity-60">Action (Python code)</div>
                <Textarea
                  className="h-20 text-xs font-mono"
                  value={func.decision.action}
                  onChange={(e) => {
                    onChange({
                      decision: {
                        ...func.decision!,
                        action: e.target.value,
                      },
                    });
                  }}
                  onFocus={handleFocus}
                  placeholder="some_action()"
                />
                <div className="mt-0.5 text-[9px] opacity-40 italic">
                  Enter Python expression (e.g., <code className="font-mono">some_action()</code>).
                  Result will be stored in <code className="font-mono">result</code>.
                </div>
              </div>

              {/* Conditions */}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <div className="text-[10px] opacity-60">Conditions</div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 text-[9px] px-1"
                    onClick={() => {
                      onChange({
                        decision: {
                          ...func.decision!,
                          conditions: [
                            ...func.decision!.conditions,
                            {
                              operator: "==" as const,
                              value: "",
                              next_node_id: "",
                            },
                          ],
                        },
                      });
                    }}
                  >
                    + Add
                  </Button>
                </div>
                {func.decision.conditions.length === 0 ? (
                  <div className="text-[10px] opacity-40 italic py-2">
                    No conditions. Default next node will always be used.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {func.decision.conditions.map((condition, condIndex) => {
                      const hasInvalidConditionNode =
                        condition.next_node_id &&
                        !availableNodeIds.includes(condition.next_node_id);
                      return (
                        <div
                          key={condIndex}
                          ref={(el) => {
                            if (el) {
                              conditionRefs.current.set(condIndex, el);
                            } else {
                              conditionRefs.current.delete(condIndex);
                            }
                          }}
                          className="rounded border p-2 space-y-2 bg-neutral-50 dark:bg-neutral-900/50"
                        >
                          <div className="flex items-center gap-2">
                            <Select
                              value={condition.operator}
                              onValueChange={(v) => {
                                const newConditions = [...func.decision!.conditions];
                                newConditions[condIndex] = {
                                  ...condition,
                                  operator: v as DecisionConditionJson["operator"],
                                };
                                onChange({
                                  decision: {
                                    ...func.decision!,
                                    conditions: newConditions,
                                  },
                                });
                              }}
                              onOpenChange={(open) => {
                                if (open) handleFocus();
                              }}
                            >
                              <SelectTrigger className="h-6 text-xs w-24" onFocus={handleFocus}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="<">&lt;</SelectItem>
                                <SelectItem value="<=">&lt;=</SelectItem>
                                <SelectItem value="==">==</SelectItem>
                                <SelectItem value=">=">&gt;=</SelectItem>
                                <SelectItem value=">">&gt;</SelectItem>
                                <SelectItem value="!=">!=</SelectItem>
                                <SelectItem value="not">not</SelectItem>
                                <SelectItem value="in">in</SelectItem>
                                <SelectItem value="not in">not in</SelectItem>
                              </SelectContent>
                            </Select>
                            <Input
                              className="h-6 text-xs flex-1"
                              value={condition.value}
                              onChange={(e) => {
                                const newConditions = [...func.decision!.conditions];
                                newConditions[condIndex] = {
                                  ...condition,
                                  value: e.target.value,
                                };
                                onChange({
                                  decision: {
                                    ...func.decision!,
                                    conditions: newConditions,
                                  },
                                });
                              }}
                              onFocus={handleFocus}
                              placeholder="Value"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs px-2"
                              onClick={() => {
                                const newConditions = func.decision!.conditions.filter(
                                  (_, i) => i !== condIndex
                                );
                                onChange({
                                  decision: {
                                    ...func.decision!,
                                    conditions: newConditions,
                                  },
                                });
                              }}
                            >
                              ×
                            </Button>
                          </div>
                          <div>
                            <div className="mb-1 text-[10px] opacity-60">Next Node</div>
                            {hasInvalidConditionNode && (
                              <div className="mb-1 text-[9px] text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-950/40 px-1.5 py-0.5 rounded">
                                Invalid: Target node "{condition.next_node_id}" was deleted
                              </div>
                            )}
                            {availableNodeIds.length > 0 ? (
                              <Select
                                value={condition.next_node_id || undefined}
                                onValueChange={(v) => {
                                  const newConditions = [...func.decision!.conditions];
                                  newConditions[condIndex] = {
                                    ...condition,
                                    next_node_id: v,
                                  };
                                  onChange({
                                    decision: {
                                      ...func.decision!,
                                      conditions: newConditions,
                                    },
                                  });
                                }}
                                onOpenChange={(open) => {
                                  if (open) handleFocus();
                                }}
                              >
                                <SelectTrigger
                                  className={`h-6 text-xs ${hasInvalidConditionNode ? "border-orange-400 dark:border-orange-500" : ""}`}
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
                              <div className="text-[10px] opacity-40 italic">
                                No other nodes available
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
);

FunctionItem.displayName = "FunctionItem";

interface PropertyItemProps {
  propName: string;
  property: FunctionProperty;
  isRequired: boolean;
  onUpdate: (updates: Partial<FunctionProperty>) => void;
  onRename: (newName: string) => void;
  onRemove: () => void;
  onRequiredChange: (isRequired: boolean) => void;
  onFocus?: () => void;
}

const propertyItemPlaceholder = `small
medium
large`;

function PropertyItem({
  propName,
  property,
  isRequired,
  onUpdate,
  onRename,
  onRemove,
  onRequiredChange,
  onFocus,
}: PropertyItemProps) {
  const [name, setName] = useState(propName);
  const [nameError, setNameError] = useState<string | null>(null);
  const [enumValues, setEnumValues] = useState(() => (property.enum || []).join("\n"));
  const [showEnum, setShowEnum] = useState(
    property.type === "string" && (property.enum?.length ?? 0) > 0
  );

  const handleNameChange = (newName: string) => {
    // Allow raw input while typing (including spaces) - only format on blur
    setName(newName);
    setNameError(null);
  };

  const handleNameBlur = () => {
    // Format and validate on blur
    const formatted = formatPropertyName(name);
    const error = validatePropertyName(formatted);

    if (error) {
      setNameError(error);
    } else {
      // Update with formatted name
      setName(formatted);
      if (formatted !== propName && formatted.trim() !== "") {
        onRename(formatted);
      } else if (formatted.trim() === "") {
        // Don't allow empty names, revert
        setName(propName);
        setNameError("Property name cannot be empty");
      }
    }
  };

  const handleEnumChange = (value: string) => {
    setEnumValues(value);
    const enumArray = value
      .split("\n")
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
    onUpdate({ enum: enumArray.length > 0 ? enumArray : undefined });
  };

  const toggleEnum = () => {
    const newShowEnum = !showEnum;
    setShowEnum(newShowEnum);
    if (!newShowEnum) {
      setEnumValues("");
      onUpdate({ enum: undefined });
    }
  };

  return (
    <div className="rounded border p-2 space-y-2 bg-neutral-50 dark:bg-neutral-900/50">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Input
            className={`h-6 text-xs flex-1 ${nameError ? "border-red-500" : ""}`}
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            onFocus={onFocus}
            onBlur={handleNameBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur();
              }
            }}
            placeholder="Property name (e.g., pizza_size)"
          />
          {nameError && <div className="mt-0.5 text-[9px] text-red-600">{nameError}</div>}
        </div>
        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Checkbox
                  checked={isRequired}
                  onCheckedChange={(checked: boolean) => onRequiredChange(checked)}
                  title="Required"
                />
              </TooltipTrigger>
              <TooltipContent>Required</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={onRemove}>
            ×
          </Button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Select
          value={property.type}
          onValueChange={(v) => onUpdate({ type: v as FunctionProperty["type"] })}
          onOpenChange={(open) => {
            if (open && onFocus) {
              onFocus();
            }
          }}
        >
          <SelectTrigger className="h-6 text-xs flex-1" onFocus={onFocus}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="string">String</SelectItem>
            <SelectItem value="integer">Integer</SelectItem>
            <SelectItem value="number">Number</SelectItem>
            <SelectItem value="boolean">Boolean</SelectItem>
          </SelectContent>
        </Select>
        {property.type === "string" && (
          <Button
            variant={showEnum ? "secondary" : "ghost"}
            size="sm"
            className="h-6 text-xs px-2"
            onClick={toggleEnum}
            title="Toggle enum"
          >
            Enum
          </Button>
        )}
      </div>
      {property.type === "integer" || property.type === "number" ? (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            className="h-6 text-xs"
            value={property.minimum ?? ""}
            onChange={(e) =>
              onUpdate({ minimum: e.target.value ? Number(e.target.value) : undefined })
            }
            onFocus={onFocus}
            placeholder="Min"
          />
          <Input
            type="number"
            className="h-6 text-xs"
            value={property.maximum ?? ""}
            onChange={(e) =>
              onUpdate({ maximum: e.target.value ? Number(e.target.value) : undefined })
            }
            onFocus={onFocus}
            placeholder="Max"
          />
        </div>
      ) : null}
      <Textarea
        className="h-12 text-xs"
        value={property.description ?? ""}
        onChange={(e) => onUpdate({ description: e.target.value || undefined })}
        onFocus={onFocus}
        placeholder="Property description"
      />
      {showEnum && property.type === "string" && (
        <div>
          <div className="mb-1 text-[10px] opacity-60">Enum values (one per line)</div>
          <Textarea
            className="h-20 text-xs font-mono"
            value={enumValues}
            onChange={(e) => handleEnumChange(e.target.value)}
            onFocus={onFocus}
            placeholder={propertyItemPlaceholder}
          />
        </div>
      )}
    </div>
  );
}
