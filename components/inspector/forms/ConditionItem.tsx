"use client";

import { X } from "lucide-react";
import { useId } from "react";

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
import type { DecisionConditionJson } from "@/lib/schema/flow.schema";

interface ConditionItemProps {
  condition: DecisionConditionJson;
  condIndex: number;
  availableNodeIds: string[];
  hasInvalidConditionNode: boolean;
  onUpdate: (condition: DecisionConditionJson) => void;
  onRemove: () => void;
  onFocus: () => void;
  conditionRef: (el: HTMLDivElement | null) => void;
}

export function ConditionItem({
  condition,
  condIndex,
  availableNodeIds,
  hasInvalidConditionNode,
  onUpdate,
  onRemove,
  onFocus,
  conditionRef,
}: ConditionItemProps) {
  const conditionOperatorId = useId();
  const conditionValueId = useId();
  const conditionNextNodeId = useId();

  return (
    <div
      ref={conditionRef}
      className="rounded-md border border-neutral-200 dark:border-neutral-700 p-3 space-y-3 bg-neutral-50/50 dark:bg-neutral-800/30"
    >
      <div className="flex items-center gap-2">
        <div className="space-y-2 flex-1">
          <label htmlFor={conditionOperatorId} className="text-xs opacity-60">
            Operator
          </label>
          <Select
            value={condition.operator}
            onValueChange={(v) => {
              onUpdate({
                ...condition,
                operator: v as DecisionConditionJson["operator"],
              });
            }}
            onOpenChange={(open) => {
              if (open) onFocus();
            }}
          >
            <SelectTrigger id={conditionOperatorId} className="h-8 text-xs" onFocus={onFocus}>
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
        </div>
        <div className="space-y-2 flex-1">
          <label htmlFor={conditionValueId} className="text-xs opacity-60">
            Value
          </label>
          <Input
            id={conditionValueId}
            className="h-8 text-xs"
            value={condition.value}
            onChange={(e) => {
              onUpdate({
                ...condition,
                value: e.target.value,
              });
            }}
            onFocus={onFocus}
            placeholder="Value to compare"
          />
        </div>
        <div className="flex items-end">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8" onClick={onRemove}>
                  <X className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Remove condition</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      <div className="space-y-2">
        <label htmlFor={conditionNextNodeId} className="text-xs opacity-60">
          Next Node
        </label>
        {hasInvalidConditionNode && (
          <div className="text-xs text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-950/40 px-2 py-1 rounded">
            Invalid: Target node "{condition.next_node_id}" was deleted
          </div>
        )}
        {availableNodeIds.length > 0 ? (
          <Select
            value={condition.next_node_id || undefined}
            onValueChange={(v) => {
              onUpdate({
                ...condition,
                next_node_id: v,
              });
            }}
            onOpenChange={(open) => {
              if (open) onFocus();
            }}
          >
            <SelectTrigger
              id={conditionNextNodeId}
              className={`h-8 text-xs ${hasInvalidConditionNode ? "border-orange-400 dark:border-orange-500" : ""}`}
              onFocus={onFocus}
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
    </div>
  );
}

