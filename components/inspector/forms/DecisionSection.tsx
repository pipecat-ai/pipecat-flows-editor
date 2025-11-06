"use client";

import { ChevronDown, ChevronRight, HelpCircle, Info, Plus } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { FlowFunctionJson } from "@/lib/schema/flow.schema";
import { useEditorStore } from "@/lib/store/editorStore";

import { ConditionItem } from "./ConditionItem";

interface DecisionSectionProps {
  func: FlowFunctionJson;
  onChange: (updates: Partial<FlowFunctionJson>) => void;
  availableNodeIds: string[];
  currentNodeId?: string;
  functionIndex: number;
  isSelected: boolean;
  selectedConditionIndex: number | null;
  onFocus: () => void;
}

export function DecisionSection({
  func,
  onChange,
  availableNodeIds,
  currentNodeId,
  functionIndex,
  isSelected,
  selectedConditionIndex,
  onFocus,
}: DecisionSectionProps) {
  const [showDecision, setShowDecision] = useState(func.decision !== undefined);
  const conditionRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const defaultNextNodeRef = useRef<HTMLElement | null>(null);
  const scrollTarget = useEditorStore((state) => state.scrollTarget);
  const setScrollTarget = useEditorStore((state) => state.setScrollTarget);
  const decisionActionId = useId();

  // Ensure decision section is expanded when a condition is selected or scroll target requires it
  // Only expand if this is the selected function or if scrollTarget matches this function
  const needsDecisionExpansion =
    func.decision &&
    !showDecision &&
    ((isSelected && selectedConditionIndex !== null) ||
      (scrollTarget &&
        scrollTarget.nodeId === currentNodeId &&
        scrollTarget.functionIndex === functionIndex &&
        scrollTarget.conditionIndex !== null));

  useEffect(() => {
    if (needsDecisionExpansion) {
      // Use setTimeout to avoid setState in effect warning
      const timeoutId = setTimeout(() => {
        setShowDecision(true);
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [
    needsDecisionExpansion,
    isSelected,
    selectedConditionIndex,
    scrollTarget,
    currentNodeId,
    functionIndex,
  ]);

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

  if (!func.decision && !showDecision) {
    return (
      <div className="pt-3 border-t border-neutral-200 dark:border-neutral-700">
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              // Create decision with current next_node_id as default
              onChange({
                decision: {
                  action: "",
                  conditions: [],
                  default_next_node_id: func.next_node_id || "",
                },
              });
              setShowDecision(true);
            }}
            className="flex items-center gap-1.5 text-xs font-medium opacity-80 hover:opacity-100 transition-opacity"
          >
            <ChevronRight className="h-4 w-4" />
            Decision
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-3 border-t border-neutral-200 dark:border-neutral-700">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            setShowDecision(!showDecision);
          }}
          className="flex items-center gap-1.5 text-xs font-medium opacity-80 hover:opacity-100 transition-opacity"
        >
          {showDecision ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          Decision
        </button>
        {func.decision && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs px-2"
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
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <label htmlFor={decisionActionId} className="text-xs opacity-60">
                Action (Python code block)
              </label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle size={16} className="text-neutral-500" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>
                      Enter Python code that sets the <code className="font-mono">result</code>{" "}
                      variable. For example:{" "}
                      <code className="font-mono">result = my_function()</code> or{" "}
                      <code className="font-mono">result, error = await my_function()</code>.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Textarea
              id={decisionActionId}
              className="min-h-32 text-xs font-mono"
              value={func.decision.action}
              onChange={(e) => {
                onChange({
                  decision: {
                    ...func.decision!,
                    action: e.target.value,
                  },
                });
              }}
              onFocus={onFocus}
              placeholder="result = my_function()"
            />
          </div>

          {/* Conditions */}
          <div className="pt-3 border-t border-neutral-200 dark:border-neutral-700">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-xs font-medium opacity-80">Conditions</div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1"
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
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
            {func.decision.conditions.length === 0 ? (
              <div className="text-xs opacity-40 italic py-2">
                No conditions. Default next node will always be used.
              </div>
            ) : (
              <div className="space-y-2">
                {func.decision.conditions.map((condition, condIndex) => {
                  const hasInvalidConditionNode = Boolean(
                    condition.next_node_id && !availableNodeIds.includes(condition.next_node_id)
                  );
                  return (
                    <ConditionItem
                      key={condIndex}
                      condition={condition}
                      condIndex={condIndex}
                      availableNodeIds={availableNodeIds}
                      hasInvalidConditionNode={hasInvalidConditionNode}
                      onUpdate={(updatedCondition) => {
                        const newConditions = [...func.decision!.conditions];
                        newConditions[condIndex] = updatedCondition;
                        onChange({
                          decision: {
                            ...func.decision!,
                            conditions: newConditions,
                          },
                        });
                      }}
                      onRemove={() => {
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
                      onFocus={onFocus}
                      conditionRef={(el) => {
                        if (el) {
                          conditionRefs.current.set(condIndex, el);
                        } else {
                          conditionRefs.current.delete(condIndex);
                        }
                      }}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
