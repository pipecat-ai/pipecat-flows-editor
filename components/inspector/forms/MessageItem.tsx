"use client";

import { Trash2 } from "lucide-react";
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
import type { FlowConfigMessage } from "@/lib/schema/flowConfig";

/** The roles Pipecat accepts in task messages. `developer` becomes `system` for LLMs that need it. */
const MESSAGE_ROLES = ["developer", "user", "assistant"] as const;

interface MessageItemProps {
  message: FlowConfigMessage;
  index: number;
  onUpdate: (updates: Partial<FlowConfigMessage>) => void;
  onRemove: () => void;
}

export function MessageItem({ message, index, onUpdate, onRemove }: MessageItemProps) {
  const messageRoleId = useId();
  const messageContentId = useId();

  return (
    <div className="space-y-2 rounded border p-3">
      <div className="flex items-center gap-2">
        <div className="space-y-2">
          <label htmlFor={messageRoleId} className="sr-only">
            Role
          </label>
          <Select value={message.role} onValueChange={(v) => onUpdate({ role: v })}>
            <SelectTrigger id={messageRoleId} className="h-8 text-xs w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MESSAGE_ROLES.map((role) => (
                <SelectItem key={role} value={role}>
                  {role}
                </SelectItem>
              ))}
              {!MESSAGE_ROLES.includes(message.role as (typeof MESSAGE_ROLES)[number]) && (
                <SelectItem value={message.role}>{message.role}</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8" onClick={onRemove}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Remove message</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div className="space-y-2">
        <label htmlFor={messageContentId} className="sr-only">
          Message content
        </label>
        <Textarea
          id={messageContentId}
          className="min-h-20 text-xs"
          value={message.content}
          onChange={(e) => onUpdate({ content: e.target.value })}
          placeholder="Message content"
        />
      </div>
    </div>
  );
}
