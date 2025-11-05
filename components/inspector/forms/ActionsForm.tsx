"use client";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ActionJson } from "@/lib/schema/flow.schema";

import { ActionItem } from "./ActionItem";

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
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs opacity-60">{label}</div>
        <Button variant="ghost" size="sm" className="h-6 gap-1" onClick={addItem}>
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>
      {items.map((action, i) => (
        <ActionItem
          key={i}
          action={action}
          index={i}
          onUpdate={(updates) => updateItem(i, updates)}
          onRemove={() => removeItem(i)}
        />
      ))}
      {items.length === 0 && (
        <div className="text-xs opacity-40 italic py-2">No actions. Click "Add" to create one.</div>
      )}
    </div>
  );
}
