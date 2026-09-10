"use client";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BUILT_IN_ACTIONS_WITHOUT_HANDLER, type FlowConfigAction } from "@/lib/schema/flowConfig";

import { ActionItem } from "./ActionItem";

type Props = {
  label: string;
  actions: FlowConfigAction[] | undefined;
  onChange: (actions: FlowConfigAction[]) => void;
};

export default function ActionsForm({ label, actions, onChange }: Props) {
  const items = actions ?? [];

  const updateItem = (index: number, updates: Partial<FlowConfigAction>) => {
    const next = [...items];
    const merged = { ...next[index], ...updates };
    // The two fixed built-ins take no handler; moving to one drops it
    if (updates.type !== undefined && BUILT_IN_ACTIONS_WITHOUT_HANDLER.has(updates.type)) {
      const { handler: _handler, ...rest } = merged;
      next[index] = rest;
    } else {
      next[index] = merged;
    }
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
        <div className="text-xs text-muted-foreground">{label}</div>
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
        <div className="text-xs text-muted-foreground italic py-2">
          No actions. Click "Add" to create one.
        </div>
      )}
    </div>
  );
}
