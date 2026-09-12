"use client";

import { Trash2 } from "lucide-react";
import { useId } from "react";

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
    // One hairline frame, as the site's live-example panel: the role and the
    // remove button share the top row in divided cells, and the text fills
    // the rest. The controls go borderless inside the frame.
    <div className="border">
      <div className="flex h-9 divide-x border-b">
        <label htmlFor={messageRoleId} className="sr-only">
          Role
        </label>
        <Select value={message.role} onValueChange={(v) => onUpdate({ role: v })}>
          <SelectTrigger
            id={messageRoleId}
            className="h-full min-w-0 flex-1 rounded-none border-0 bg-transparent px-3 text-[13px] shadow-none focus:ring-1 focus:ring-inset"
          >
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
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onRemove}
                aria-label="Remove message"
                className="flex w-10 shrink-0 items-center justify-center text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <Trash2 className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Remove message</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <label htmlFor={messageContentId} className="sr-only">
        Message content
      </label>
      <Textarea
        id={messageContentId}
        className="block min-h-40 w-full rounded-none border-0 p-3 text-[13px] shadow-none focus-visible:ring-1 focus-visible:ring-inset"
        value={message.content}
        onChange={(e) => onUpdate({ content: e.target.value })}
        placeholder="Message content"
      />
    </div>
  );
}
