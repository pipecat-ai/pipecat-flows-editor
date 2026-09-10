"use client";

import { Trash2 } from "lucide-react";
import { useId, useState } from "react";

import { Segment } from "@/components/inspector/Segment";
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
import { BUILT_IN_ACTIONS, type FlowConfigAction } from "@/lib/schema/flowConfig";

const CUSTOM = "__custom__";

interface ActionItemProps {
  action: FlowConfigAction;
  index: number;
  onUpdate: (updates: Partial<FlowConfigAction>) => void;
  onRemove: () => void;
}

/** The segment's title: what the action does, in a few words. */
function describe(action: FlowConfigAction): string {
  if (action.type === "tts_say") {
    const text = typeof action.text === "string" ? action.text.trim() : "";
    return text ? `Say “${text.length > 40 ? `${text.slice(0, 39)}…` : text}”` : "Say a line";
  }
  if (action.type === "end_conversation") return "End the conversation";
  if (action.type === "function") return action.handler ? `Run ${action.handler}` : "Run a handler";
  return action.type || "Custom action";
}

/** Whether the action still needs something typed in; such a segment opens expanded. */
function needsInput(action: FlowConfigAction): boolean {
  if (action.type === "function") return !action.handler;
  if (action.type === "tts_say") return typeof action.text !== "string" || !action.text.trim();
  if (!BUILT_IN_ACTIONS.has(action.type)) return !action.type;
  return false;
}

/**
 * An action as a sidebar segment. The fields stack full width, one per row,
 * so a custom type with its handler fits the sidebar at any width.
 */
export function ActionItem({ action, index, onUpdate, onRemove }: ActionItemProps) {
  const actionTypeId = useId();
  const actionCustomTypeId = useId();
  const actionHandlerId = useId();
  const actionTextId = useId();
  const [expanded, setExpanded] = useState(() => needsInput(action));
  const isCustom = !BUILT_IN_ACTIONS.has(action.type);
  // A handler is required on function actions, allowed on custom types, and
  // not allowed on the two built-ins whose behavior is fixed
  const takesHandler = action.type === "function" || isCustom;
  const labelClass = "text-[13px] text-muted-foreground";
  const fieldClass = "h-8 w-full text-[13px]";

  return (
    <Segment
      title={describe(action)}
      expanded={expanded}
      onToggle={() => setExpanded(!expanded)}
      invalid={action.type === "function" && !action.handler}
      actions={
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 shrink-0 p-0 text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove();
                }}
                aria-label={`Remove action ${index + 1}`}
              >
                <Trash2 className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Remove action</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      }
    >
      <div className="space-y-2">
        <label htmlFor={actionTypeId} className={labelClass}>
          Type
        </label>
        <Select
          value={isCustom ? CUSTOM : action.type}
          onValueChange={(v) => onUpdate({ type: v === CUSTOM ? "" : v })}
        >
          <SelectTrigger id={actionTypeId} className={fieldClass}>
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
        <div className="space-y-2">
          <label htmlFor={actionCustomTypeId} className={labelClass}>
            Custom type
          </label>
          <Input
            id={actionCustomTypeId}
            className={`${fieldClass} font-mono`}
            value={action.type}
            onChange={(e) => onUpdate({ type: e.target.value })}
            placeholder="type"
            title="A custom action type; its handler is named here or registered in code"
          />
        </div>
      )}
      {takesHandler && (
        <div className="space-y-2">
          <label htmlFor={actionHandlerId} className={labelClass}>
            {isCustom ? "Handler (optional)" : "Handler"}
          </label>
          <Input
            id={actionHandlerId}
            className={`${fieldClass} font-mono`}
            value={action.handler ?? ""}
            onChange={(e) => onUpdate({ handler: e.target.value || undefined })}
            placeholder={
              isCustom ? "Registered in code when empty" : "A handler in the handlers module"
            }
            title={
              isCustom
                ? "Leave empty for a handler registered in code with FlowManager.register_action"
                : "A handler in the handlers module"
            }
          />
        </div>
      )}
      {action.type === "tts_say" && (
        <div className="space-y-2">
          <label htmlFor={actionTextId} className={labelClass}>
            Text to say
          </label>
          <Textarea
            id={actionTextId}
            className="min-h-20 text-[13px]"
            value={typeof action.text === "string" ? action.text : ""}
            onChange={(e) => onUpdate({ text: e.target.value })}
            placeholder="Text to say"
          />
        </div>
      )}
    </Segment>
  );
}
