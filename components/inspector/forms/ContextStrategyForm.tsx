"use client";

import { RotateCcw } from "lucide-react";
import { useId } from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { FlowConfigNode } from "@/lib/schema/flowConfig";

type ContextStrategy = NonNullable<FlowConfigNode["context_strategy"]>;

type Props = {
  value: ContextStrategy | null | undefined;
  onChange: (strategy: ContextStrategy | undefined) => void;
};

const DEFAULT = "default";

export default function ContextStrategyForm({ value, onChange }: Props) {
  const selectId = useId();
  const current = value ?? DEFAULT;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label htmlFor={selectId} className="text-xs opacity-60">
          Context Strategy
        </label>
        {value && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1"
                  onClick={() => onChange(undefined)}
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset
                </Button>
              </TooltipTrigger>
              <TooltipContent>Use the flow manager's strategy</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <Select
        value={current}
        onValueChange={(v) => onChange(v === DEFAULT ? undefined : (v as ContextStrategy))}
      >
        <SelectTrigger id={selectId} className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={DEFAULT}>Flow manager default</SelectItem>
          <SelectItem value="append">append</SelectItem>
          <SelectItem value="reset">reset</SelectItem>
        </SelectContent>
      </Select>
      <div className="text-xs opacity-40 italic py-1">
        How the LLM context is updated on entering this node.
      </div>
    </div>
  );
}
