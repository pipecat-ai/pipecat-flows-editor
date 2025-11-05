"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { MessageJson } from "@/lib/schema/flow.schema";

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
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-[11px] opacity-60">{label}</div>
        <Button variant="ghost" size="sm" className="h-5 text-xs px-2" onClick={addItem}>
          + Add
        </Button>
      </div>
      {items.map((msg, i) => (
        <div key={i} className="space-y-1 rounded border p-2">
          <div className="flex items-center justify-between">
            <Select
              value={msg.role}
              onValueChange={(v: "system" | "user" | "assistant") => updateItem(i, { role: v })}
            >
              <SelectTrigger className="h-6 text-xs w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">System</SelectItem>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="assistant">Assistant</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs px-2"
              onClick={() => removeItem(i)}
            >
              ×
            </Button>
          </div>
          <Textarea
            className="h-32 min-h-16 max-h-64 text-xs"
            value={msg.content}
            onChange={(e) => updateItem(i, { content: e.target.value })}
            placeholder="Message content"
          />
        </div>
      ))}
      {items.length === 0 && (
        <div className="text-[11px] opacity-40 italic">
          No messages. Click "+ Add" to create one.
        </div>
      )}
    </div>
  );
}
