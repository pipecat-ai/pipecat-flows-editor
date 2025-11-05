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
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { ContextStrategyConfigJson } from "@/lib/schema/flow.schema";

type Props = {
  contextStrategy: ContextStrategyConfigJson | undefined;
  onChange: (strategy: ContextStrategyConfigJson | undefined) => void;
};

export default function ContextStrategyForm({ contextStrategy, onChange }: Props) {
  const strategy = contextStrategy?.strategy ?? "APPEND";
  const summaryPrompt = contextStrategy?.summary_prompt ?? "";
  const contextStrategyId = useId();
  const summaryPromptId = useId();

  const handleStrategyChange = (newStrategy: string) => {
    if (newStrategy === "APPEND") {
      // If switching to APPEND, remove context_strategy (use default)
      onChange(undefined);
    } else if (newStrategy === "RESET") {
      // RESET doesn't need summary_prompt
      onChange({ strategy: "RESET" });
    } else if (newStrategy === "RESET_WITH_SUMMARY") {
      // RESET_WITH_SUMMARY needs summary_prompt
      onChange({
        strategy: "RESET_WITH_SUMMARY",
        summary_prompt: summaryPrompt || "",
      });
    }
  };

  const handleSummaryPromptChange = (prompt: string) => {
    if (strategy === "RESET_WITH_SUMMARY") {
      onChange({
        strategy: "RESET_WITH_SUMMARY",
        summary_prompt: prompt,
      });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label htmlFor={contextStrategyId} className="text-xs opacity-60">
          Context Strategy
        </label>
        {contextStrategy && (
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
              <TooltipContent>Reset to default (APPEND)</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <Select value={strategy} onValueChange={handleStrategyChange}>
        <SelectTrigger id={contextStrategyId} className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="APPEND">APPEND (default)</SelectItem>
          <SelectItem value="RESET">RESET</SelectItem>
          <SelectItem value="RESET_WITH_SUMMARY">RESET_WITH_SUMMARY</SelectItem>
        </SelectContent>
      </Select>
      {strategy === "RESET_WITH_SUMMARY" && (
        <div className="space-y-2">
          <label htmlFor={summaryPromptId} className="text-xs opacity-60">
            Summary Prompt
          </label>
          <Textarea
            id={summaryPromptId}
            className="min-h-20 text-xs"
            value={summaryPrompt}
            onChange={(e) => handleSummaryPromptChange(e.target.value)}
            placeholder="Provide a concise summary of the customer's order details and preferences."
          />
        </div>
      )}
      {strategy === "APPEND" && (
        <div className="text-xs opacity-40 italic py-1">
          APPEND is the default strategy. Remove this configuration to use the default.
        </div>
      )}
    </div>
  );
}
