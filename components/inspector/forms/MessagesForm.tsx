"use client";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { FlowConfigMessage } from "@/lib/schema/flowConfig";

import { MessageItem } from "./MessageItem";

type Props = {
  label: string;
  /** A small mono tag beside the label, such as "required". */
  tag?: string;
  /** One line under the label saying what the messages are for. */
  hint?: string;
  messages: FlowConfigMessage[] | undefined;
  onChange: (messages: FlowConfigMessage[]) => void;
};

/** The small mono tag the inspector uses to mark a field required or optional. */
export const FIELD_TAG_CLASS =
  "font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground/70";

export default function MessagesForm({ label, tag, hint, messages, onChange }: Props) {
  const items = messages ?? [];

  const updateItem = (index: number, updates: Partial<FlowConfigMessage>) => {
    const next = [...items];
    next[index] = { ...next[index], ...updates };
    onChange(next);
  };

  const addItem = () => {
    onChange([...items, { role: "developer", content: "" }]);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <div className="text-[13px] text-muted-foreground">{label}</div>
          {tag && <span className={FIELD_TAG_CLASS}>{tag}</span>}
        </div>
        <Button variant="ghost" size="sm" className="h-6 gap-1" onClick={addItem}>
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      {items.map((msg, i) => (
        <MessageItem
          key={i}
          message={msg}
          index={i}
          onUpdate={(updates) => updateItem(i, updates)}
          onRemove={() => removeItem(i)}
        />
      ))}
      {items.length === 0 && (
        <div className="text-[13px] text-muted-foreground italic py-2">
          No messages. Click "Add" to create one.
        </div>
      )}
    </div>
  );
}
