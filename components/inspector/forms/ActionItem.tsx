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
import type { ActionJson } from "@/lib/schema/flow.schema";

interface ActionItemProps {
  action: ActionJson;
  index: number;
  onUpdate: (updates: Partial<ActionJson>) => void;
  onRemove: () => void;
}

export function ActionItem({ action, index, onUpdate, onRemove }: ActionItemProps) {
  const actionTypeId = useId();
  const actionHandlerId = useId();
  const actionTextId = useId();

  return (
    <div className="flex items-center gap-2 rounded border p-3">
      <div className="flex-1 space-y-2">
        <label htmlFor={actionTypeId} className="sr-only">
          Action Type
        </label>
        <Select value={action.type} onValueChange={(v) => onUpdate({ type: v })}>
          <SelectTrigger id={actionTypeId} className="h-8 text-xs flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="function">Function</SelectItem>
            <SelectItem value="end_conversation">End Conversation</SelectItem>
            <SelectItem value="tts_say">TTS Say</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {action.type === "function" && (
        <div className="w-32 space-y-2">
          <label htmlFor={actionHandlerId} className="sr-only">
            Handler
          </label>
          <Input
            id={actionHandlerId}
            className="h-8 text-xs w-32"
            value={action.handler ?? ""}
            onChange={(e) => onUpdate({ handler: e.target.value })}
            placeholder="Handler"
          />
        </div>
      )}
      {action.type === "tts_say" && (
        <div className="flex-1 space-y-2">
          <label htmlFor={actionTextId} className="sr-only">
            Text to say
          </label>
          <Input
            id={actionTextId}
            className="h-8 text-xs flex-1"
            value={action.text ?? ""}
            onChange={(e) => onUpdate({ text: e.target.value })}
            placeholder="Text to say"
          />
        </div>
      )}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8" onClick={onRemove}>
              <X className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Remove action</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

