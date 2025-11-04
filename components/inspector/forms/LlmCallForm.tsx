"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  data: any;
  onChange: (partial: Record<string, unknown>) => void;
};

export default function LlmCallForm({ data, onChange }: Props) {
  return (
    <div className="space-y-2">
      <label className="block">
        <div className="mb-1 text-[11px] opacity-60">Model</div>
        <Input
          value={(data?.model as string) ?? ""}
          onChange={(e) => onChange({ model: e.target.value })}
          placeholder="e.g. gpt-4o"
        />
      </label>
      <label className="block">
        <div className="mb-1 text-[11px] opacity-60">System</div>
        <Textarea
          className="h-20"
          value={(data?.system as string) ?? ""}
          onChange={(e) => onChange({ system: e.target.value })}
          placeholder="System prompt"
        />
      </label>
      <label className="block">
        <div className="mb-1 text-[11px] opacity-60">Prompt</div>
        <Textarea
          className="h-28"
          value={(data?.prompt as string) ?? ""}
          onChange={(e) => onChange({ prompt: e.target.value })}
          placeholder="User prompt"
        />
      </label>
      <label className="block">
        <div className="mb-1 text-[11px] opacity-60">Temperature</div>
        <Input
          type="number"
          step="0.1"
          min="0"
          max="2"
          value={(data?.temperature as number | undefined) ?? 1}
          onChange={(e) => onChange({ temperature: Number(e.target.value) })}
        />
      </label>
    </div>
  );
}
