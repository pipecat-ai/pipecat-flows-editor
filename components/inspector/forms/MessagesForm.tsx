"use client";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { MessageJson } from "@/lib/schema/flow.schema";

import { MessageItem } from "./MessageItem";

type Props = {
  label: string;
  messages: MessageJson[] | undefined;
  onChange: (messages: MessageJson[]) => void;
};

export default function MessagesForm({ label, messages, onChange }: Props) {
  const items = messages ?? [];

  const updateItem = (index: number, updates: Partial<MessageJson>) => {
    const next = [...items];
    next[index] = { ...next[index], ...updates };
    onChange(next);
  };

  const addItem = () => {
    onChange([...items, { role: "system", content: "" }]);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs opacity-60">{label}</div>
        <Button variant="ghost" size="sm" className="h-6 gap-1" onClick={addItem}>
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>
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
        <div className="text-xs opacity-40 italic py-2">
          No messages. Click "Add" to create one.
        </div>
      )}
    </div>
  );
}
