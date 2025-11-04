"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ContextStrategyConfigJson } from "@/lib/schema/flow.schema";

type Props = {
  contextStrategy: ContextStrategyConfigJson | undefined;
  onChange: (strategy: ContextStrategyConfigJson | undefined) => void;
};

export default function ContextStrategyForm({ contextStrategy, onChange }: Props) {
  const strategy = contextStrategy?.strategy ?? "APPEND";
  const summaryPrompt = contextStrategy?.summary_prompt ?? "";

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
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-[11px] opacity-60">Context Strategy</div>
        {contextStrategy && (
          <Button
            variant="ghost"
            size="sm"
            className="h-5 text-xs px-2"
            onClick={() => onChange(undefined)}
            title="Reset to default (APPEND)"
          >
            Reset
          </Button>
        )}
      </div>
      <Select value={strategy} onValueChange={handleStrategyChange}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="APPEND">APPEND (default)</SelectItem>
          <SelectItem value="RESET">RESET</SelectItem>
          <SelectItem value="RESET_WITH_SUMMARY">RESET_WITH_SUMMARY</SelectItem>
        </SelectContent>
      </Select>
      {strategy === "RESET_WITH_SUMMARY" && (
        <div>
          <div className="mb-1 text-[11px] opacity-60">Summary Prompt</div>
          <Textarea
            className="h-20 text-xs"
            value={summaryPrompt}
            onChange={(e) => handleSummaryPromptChange(e.target.value)}
            placeholder="Provide a concise summary of the customer's order details and preferences."
          />
        </div>
      )}
      {strategy === "APPEND" && (
        <div className="text-[11px] opacity-40 italic">
          APPEND is the default strategy. Remove this configuration to use the default.
        </div>
      )}
    </div>
  );
}

