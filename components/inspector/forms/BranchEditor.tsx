"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { FlowConfigBranch } from "@/lib/schema/flowConfig";
import { addCase, removeCase, renameCase, setCaseTarget } from "@/lib/utils/branchEdits";

const NO_DEFAULT = "__none__";

interface BranchEditorProps {
  branch: FlowConfigBranch;
  onChange: (branch: FlowConfigBranch) => void;
  availableNodeIds: string[];
  /** The node the function belongs to; the target for a new case. */
  currentNodeId?: string;
  selectedConditionIndex: number | null; // -1 for the default, 0+ for a case index
  onFocus?: () => void;
}

/**
 * A branch table: the field of the tool's result to branch on, one row per
 * value with the node it leads to, and an optional default.
 */
export default function BranchEditor({
  branch,
  onChange,
  availableNodeIds,
  currentNodeId,
  selectedConditionIndex,
  onFocus,
}: BranchEditorProps) {
  const fieldId = useId();
  const defaultId = useId();
  const rows = Object.entries(branch.cases);
  const missing = (target: string) => target !== "" && !availableNodeIds.includes(target);

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <label htmlFor={fieldId} className="text-xs opacity-60">
          Field of the tool's result
        </label>
        <Input
          id={fieldId}
          className="h-8 text-xs font-mono"
          value={branch.field}
          onChange={(e) => onChange({ ...branch, field: e.target.value })}
          onFocus={onFocus}
          placeholder="e.g., status"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs opacity-60">Cases</div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1"
            onClick={() =>
              onChange({
                ...branch,
                cases: addCase(branch.cases, currentNodeId ?? availableNodeIds[0] ?? ""),
              })
            }
          >
            <Plus className="h-4 w-4" /> Add case
          </Button>
        </div>
        {rows.length === 0 && (
          <div className="text-xs text-orange-600 dark:text-orange-400">
            A branch needs at least one case.
          </div>
        )}
        {rows.map(([value, target], index) => (
          <CaseRow
            key={index}
            value={value}
            target={target}
            targetMissing={missing(target)}
            availableNodeIds={availableNodeIds}
            isSelected={selectedConditionIndex === index}
            canRemove={rows.length > 1}
            onFocus={onFocus}
            onRename={(next) => {
              const cases = renameCase(branch.cases, value, next);
              if (cases) onChange({ ...branch, cases });
              return cases !== null;
            }}
            onTarget={(next) =>
              onChange({ ...branch, cases: setCaseTarget(branch.cases, value, next) })
            }
            onRemove={() => onChange({ ...branch, cases: removeCase(branch.cases, value) })}
          />
        ))}
      </div>

      <div className="space-y-1">
        <label
          htmlFor={defaultId}
          className={`text-xs opacity-60 ${selectedConditionIndex === -1 ? "font-semibold" : ""}`}
        >
          Default
        </label>
        <Select
          value={branch.default ?? NO_DEFAULT}
          onValueChange={(v) => {
            const { default: _default, ...rest } = branch;
            onChange(v === NO_DEFAULT ? rest : { ...rest, default: v });
          }}
          onOpenChange={(open) => {
            if (open) onFocus?.();
          }}
        >
          <SelectTrigger
            id={defaultId}
            className={`h-8 text-xs ${
              branch.default && missing(branch.default)
                ? "border-orange-400 dark:border-orange-500"
                : ""
            } ${selectedConditionIndex === -1 ? "ring-2 ring-blue-500 dark:ring-blue-400" : ""}`}
            onFocus={onFocus}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_DEFAULT}>None: unmatched values stay on this node</SelectItem>
            {availableNodeIds.map((nodeId) => (
              <SelectItem key={nodeId} value={nodeId}>
                {nodeId}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

interface CaseRowProps {
  value: string;
  target: string;
  targetMissing: boolean;
  availableNodeIds: string[];
  isSelected: boolean;
  canRemove: boolean;
  onFocus?: () => void;
  /** Returns false when the new value was rejected (empty or already a case). */
  onRename: (value: string) => boolean;
  onTarget: (target: string) => void;
  onRemove: () => void;
}

function CaseRow({
  value,
  target,
  targetMissing,
  availableNodeIds,
  isSelected,
  canRemove,
  onFocus,
  onRename,
  onTarget,
  onRemove,
}: CaseRowProps) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(value);
    setError(null);
  }, [value]);

  const commit = () => {
    const next = draft.trim();
    if (next === value) return;
    if (onRename(next)) {
      setError(null);
    } else {
      setError(next === "" ? "A case needs a value" : "Another case has this value");
    }
  };

  return (
    <div
      className={`rounded border p-2 space-y-1 ${
        isSelected ? "ring-2 ring-blue-500 dark:ring-blue-400" : ""
      } ${targetMissing ? "border-orange-400 dark:border-orange-500" : ""}`}
    >
      <div className="flex items-center gap-2">
        <Input
          className={`h-8 text-xs font-mono flex-1 ${error ? "border-red-500" : ""}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={onFocus}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          placeholder="value"
          aria-label="Case value"
        />
        <span className="text-xs opacity-60">→</span>
        <Select
          value={target || undefined}
          onValueChange={onTarget}
          onOpenChange={(open) => {
            if (open) onFocus?.();
          }}
        >
          <SelectTrigger className="h-8 text-xs flex-1" onFocus={onFocus} aria-label="Case target">
            <SelectValue placeholder="Select node..." />
          </SelectTrigger>
          <SelectContent>
            {availableNodeIds.map((nodeId) => (
              <SelectItem key={nodeId} value={nodeId}>
                {nodeId}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 shrink-0"
                onClick={onRemove}
                disabled={!canRemove}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {canRemove
                ? "Remove case"
                : "A branch keeps at least one case; clear the destination instead"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      {error && <div className="text-xs text-red-600">{error}</div>}
      {targetMissing && (
        <div className="text-xs text-orange-600 dark:text-orange-400">
          Invalid: no node named "{target}"
        </div>
      )}
    </div>
  );
}
