"use client";

import { Trash2 } from "lucide-react";
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
import { BUILT_IN_ACTIONS, type FlowConfigAction } from "@/lib/schema/flowConfig";

const CUSTOM = "__custom__";

interface ActionItemProps {
  action: FlowConfigAction;
  index: number;
  onUpdate: (updates: Partial<FlowConfigAction>) => void;
  onRemove: () => void;
}

export function ActionItem({ action, index, onUpdate, onRemove }: ActionItemProps) {
  const actionTypeId = useId();
  const actionCustomTypeId = useId();
  const actionHandlerId = useId();
  const actionTextId = useId();
  const isCustom = !BUILT_IN_ACTIONS.has(action.type);
  // A handler is required on function actions, allowed on custom types, and
  // not allowed on the two built-ins whose behavior is fixed
  const takesHandler = action.type === "function" || isCustom;

  return (
    <div className="flex items-center gap-2 border p-3">
      <div className="flex-1 space-y-2">
        <label htmlFor={actionTypeId} className="sr-only">
          Action Type
        </label>
        <Select
          value={isCustom ? CUSTOM : action.type}
          onValueChange={(v) => onUpdate({ type: v === CUSTOM ? "" : v })}
        >
          <SelectTrigger id={actionTypeId} className="h-8 text-[13px] flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="function">Function</SelectItem>
            <SelectItem value="end_conversation">End Conversation</SelectItem>
            <SelectItem value="tts_say">TTS Say</SelectItem>
            <SelectItem value={CUSTOM}>Custom type…</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {isCustom && (
        <div className="w-32 space-y-2">
          <label htmlFor={actionCustomTypeId} className="sr-only">
            Custom action type
          </label>
          <Input
            id={actionCustomTypeId}
            className="h-8 text-[13px] w-32 font-mono"
            value={action.type}
            onChange={(e) => onUpdate({ type: e.target.value })}
            placeholder="type"
            title="A custom action type; its handler is named here or registered in code"
          />
        </div>
      )}
      {takesHandler && (
        <div className="w-32 space-y-2">
          <label htmlFor={actionHandlerId} className="sr-only">
            Handler
          </label>
          <Input
            id={actionHandlerId}
            className="h-8 text-[13px] w-32"
            value={action.handler ?? ""}
            onChange={(e) => onUpdate({ handler: e.target.value || undefined })}
            placeholder={isCustom ? "Handler (optional)" : "Handler"}
            title={
              isCustom
                ? "Leave empty for a handler registered in code with FlowManager.register_action"
                : "A handler in the tools module"
            }
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
            className="h-8 text-[13px] flex-1"
            value={typeof action.text === "string" ? action.text : ""}
            onChange={(e) => onUpdate({ text: e.target.value })}
            placeholder="Text to say"
          />
        </div>
      )}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8" onClick={onRemove}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Remove action</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
