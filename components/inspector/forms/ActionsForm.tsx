"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ActionJson } from "@/lib/schema/flow.schema";

type Props = {
  label: string;
  actions: ActionJson[] | undefined;
  onChange: (actions: ActionJson[]) => void;
};

export default function ActionsForm({ label, actions, onChange }: Props) {
  const items = actions ?? [];

  const updateItem = (index: number, updates: Partial<ActionJson>) => {
    const next = [...items];
    next[index] = { ...next[index], ...updates };
    onChange(next);
  };

  const addItem = () => {
    onChange([...items, { type: "function" }]);
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
      {items.map((action, i) => (
        <div key={i} className="flex items-center gap-2 rounded border p-2">
          <Select value={action.type} onValueChange={(v) => updateItem(i, { type: v })}>
            <SelectTrigger className="h-6 text-xs flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="function">Function</SelectItem>
              <SelectItem value="end_conversation">End Conversation</SelectItem>
              <SelectItem value="tts_say">TTS Say</SelectItem>
            </SelectContent>
          </Select>
          {action.type === "function" && (
            <Input
              className="h-6 text-xs w-24"
              value={action.handler ?? ""}
              onChange={(e) => updateItem(i, { handler: e.target.value })}
              placeholder="Handler"
            />
          )}
          {action.type === "tts_say" && (
            <Input
              className="h-6 text-xs flex-1"
              value={action.text ?? ""}
              onChange={(e) => updateItem(i, { text: e.target.value })}
              placeholder="Text to say"
            />
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs px-2"
            onClick={() => removeItem(i)}
          >
            ×
          </Button>
        </div>
      ))}
      {items.length === 0 && (
        <div className="text-[11px] opacity-40 italic">
          No actions. Click "+ Add" to create one.
        </div>
      )}
    </div>
  );
}
