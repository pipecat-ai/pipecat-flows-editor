"use client";

import { HelpCircle, Trash2 } from "lucide-react";
import { useId, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatPropertyName, validatePropertyName } from "@/lib/utils/nameFormatting";

export type FunctionProperty = {
  type: "string" | "integer" | "number" | "boolean";
  description?: string;
  enum?: string[];
  minimum?: number;
  maximum?: number;
  pattern?: string;
};

const propertyItemPlaceholder = `small
medium
large`;

interface PropertyItemProps {
  propName: string;
  property: FunctionProperty;
  isRequired: boolean;
  onUpdate: (updates: Partial<FunctionProperty>) => void;
  onRename: (newName: string) => void;
  onRemove: () => void;
  onRequiredChange: (isRequired: boolean) => void;
  onFocus?: () => void;
}

export function PropertyItem({
  propName,
  property,
  isRequired,
  onUpdate,
  onRename,
  onRemove,
  onRequiredChange,
  onFocus,
}: PropertyItemProps) {
  const [name, setName] = useState(propName);
  const [nameError, setNameError] = useState<string | null>(null);
  const [enumValues, setEnumValues] = useState(() => (property.enum || []).join("\n"));
  const [patternValue, setPatternValue] = useState(() => property.pattern ?? "");
  const propertyNameId = useId();
  const propertyTypeId = useId();
  const propertyValidationId = useId();
  const propertyMinimumId = useId();
  const propertyMaximumId = useId();
  const propertyDescriptionId = useId();
  const propertyEnumId = useId();
  const propertyPatternId = useId();
  const requiredCheckboxId = useId();

  // Derive current validation type from property values
  // Check for enum array existence (even if empty) or pattern string existence (even if empty)
  const derivedValidationType = useMemo<"enum" | "pattern" | "none">(() => {
    if (property.type !== "string") return "none";
    // Check if enum property exists (array, even if empty) - this indicates enum mode
    if (property.enum !== undefined) return "enum";
    // Check if pattern property exists (string, even if empty) - this indicates pattern mode
    if (property.pattern !== undefined) return "pattern";
    return "none";
  }, [property.type, property.enum, property.pattern]);

  // Use derivedValidationType directly - it's now based on property existence, not just values
  const validationType = derivedValidationType;

  // Derive enumValues and patternValue from property when validation type changes
  const currentEnumValues = useMemo(() => {
    if (validationType === "enum" && property.enum !== undefined) {
      // Join with newlines, preserving empty strings as empty lines
      return property.enum.join("\n");
    }
    return enumValues;
  }, [validationType, property.enum, enumValues]);

  const currentPatternValue = useMemo(() => {
    if (validationType === "pattern" && property.pattern !== undefined) {
      return property.pattern;
    }
    return patternValue;
  }, [validationType, property.pattern, patternValue]);

  const handleNameChange = (newName: string) => {
    // Allow raw input while typing (including spaces) - only format on blur
    setName(newName);
    setNameError(null);
  };

  const handleNameBlur = () => {
    // Format and validate on blur
    const formatted = formatPropertyName(name);
    const error = validatePropertyName(formatted);

    if (error) {
      setNameError(error);
    } else {
      // Update with formatted name
      setName(formatted);
      if (formatted !== propName && formatted.trim() !== "") {
        onRename(formatted);
      } else if (formatted.trim() === "") {
        // Don't allow empty names, revert
        setName(propName);
        setNameError("Property name cannot be empty");
      }
    }
  };

  const handleEnumChange = (value: string) => {
    setEnumValues(value);
    // Split by newlines, preserving leading and trailing empty strings
    const lines = value.split("\n");
    // Find the first and last non-empty lines to determine where actual content starts/ends
    let firstNonEmptyIndex = -1;
    let lastNonEmptyIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().length > 0) {
        if (firstNonEmptyIndex === -1) firstNonEmptyIndex = i;
        lastNonEmptyIndex = i;
      }
    }
    
    // Process lines: preserve leading/trailing empty lines, trim and filter middle empty lines
    const enumArray: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      const isBeforeContent = firstNonEmptyIndex !== -1 && i < firstNonEmptyIndex;
      const isAfterContent = lastNonEmptyIndex !== -1 && i > lastNonEmptyIndex;
      
      // Preserve leading and trailing empty lines (to allow leading/trailing newlines)
      if (isBeforeContent || isAfterContent) {
        enumArray.push(""); // Preserve as empty string to maintain newline
      } else if (trimmed.length > 0) {
        enumArray.push(trimmed); // Trim middle lines but keep non-empty ones
      }
      // Skip middle empty lines (they're just extra blank lines between options)
    }
    // Keep empty array if in enum mode, otherwise undefined (switches to none)
    const enumValue = validationType === "enum" ? enumArray : undefined;
    onUpdate({ enum: enumValue, pattern: undefined });
  };

  const handlePatternChange = (value: string) => {
    setPatternValue(value);
    const trimmed = value.trim();
    // Keep empty string if in pattern mode to maintain selection, otherwise undefined (switches to none)
    const patternValue = validationType === "pattern" ? trimmed : trimmed || undefined;
    onUpdate({ pattern: patternValue, enum: undefined });
  };

  const handleValidationTypeChange = (value: "enum" | "pattern" | "none") => {
    if (value === "enum") {
      // Clear pattern when switching to enum
      setPatternValue("");
      onUpdate({ pattern: undefined, enum: property.enum ?? [] });
      // Initialize enum state if needed
      if (!property.enum || property.enum.length === 0) {
        setEnumValues("");
      }
    } else if (value === "pattern") {
      // Clear enum when switching to pattern
      setEnumValues("");
      onUpdate({ enum: undefined, pattern: property.pattern ?? "" });
      // Initialize pattern state if needed
      if (!property.pattern) {
        setPatternValue("");
      }
    } else {
      // Clear both when switching to none
      setEnumValues("");
      setPatternValue("");
      onUpdate({ enum: undefined, pattern: undefined });
    }
  };

  return (
    <div className="rounded-md border border-neutral-200 dark:border-neutral-700 p-3 space-y-3 bg-white dark:bg-neutral-900">
      <div className="flex items-start gap-2">
        <div className="space-y-2 flex-1">
          <label htmlFor={propertyNameId} className="text-xs opacity-60">
            Property name
          </label>
          <Input
            id={propertyNameId}
            className={`h-8 text-xs flex-1 ${nameError ? "border-red-500" : ""}`}
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            onFocus={onFocus}
            onBlur={handleNameBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur();
              }
            }}
            placeholder="e.g., pizza_size"
          />
          {nameError && <div className="mt-1 text-xs text-red-600">{nameError}</div>}
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8" onClick={onRemove}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Remove property</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          checked={isRequired}
          onCheckedChange={(checked: boolean) => onRequiredChange(checked)}
          id={requiredCheckboxId}
        />
        <label htmlFor={requiredCheckboxId} className="text-xs opacity-60 cursor-pointer">
          Required
        </label>
      </div>
      <div className="space-y-2">
        <label htmlFor={propertyTypeId} className="text-xs opacity-60">
          Type
        </label>
        <Select
          value={property.type}
          onValueChange={(v) => onUpdate({ type: v as FunctionProperty["type"] })}
          onOpenChange={(open) => {
            if (open && onFocus) {
              onFocus();
            }
          }}
        >
          <SelectTrigger id={propertyTypeId} className="h-8 text-xs" onFocus={onFocus}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="string">String</SelectItem>
            <SelectItem value="integer">Integer</SelectItem>
            <SelectItem value="number">Number</SelectItem>
            <SelectItem value="boolean">Boolean</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {property.type === "string" && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <label htmlFor={propertyValidationId} className="text-xs opacity-60">
              Validation
            </label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-3.5 w-3.5 opacity-40 hover:opacity-60 cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <div className="space-y-1.5 text-xs">
                    <div>
                      <strong>None:</strong> No validation constraints. Any string value is
                      accepted.
                    </div>
                    <div>
                      <strong>Enum:</strong> Restrict input to a fixed list of allowed values.
                    </div>
                    <div>
                      <strong>Pattern:</strong> Validate input using a regular expression pattern.
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Select
            value={validationType}
            onValueChange={(v) => handleValidationTypeChange(v as "enum" | "pattern" | "none")}
            onOpenChange={(open) => {
              if (open && onFocus) {
                onFocus();
              }
            }}
          >
            <SelectTrigger id={propertyValidationId} className="h-8 text-xs" onFocus={onFocus}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="enum">Enum</SelectItem>
              <SelectItem value="pattern">Pattern</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      {property.type === "integer" || property.type === "number" ? (
        <div className="flex items-center gap-2">
          <div className="space-y-2">
            <label htmlFor={propertyMinimumId} className="text-xs opacity-60">
              Min
            </label>
            <Input
              id={propertyMinimumId}
              type="number"
              className="h-8 text-xs"
              value={property.minimum ?? ""}
              onChange={(e) =>
                onUpdate({ minimum: e.target.value ? Number(e.target.value) : undefined })
              }
              onFocus={onFocus}
              placeholder="Min"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor={propertyMaximumId} className="text-xs opacity-60">
              Max
            </label>
            <Input
              id={propertyMaximumId}
              type="number"
              className="h-8 text-xs"
              value={property.maximum ?? ""}
              onChange={(e) =>
                onUpdate({ maximum: e.target.value ? Number(e.target.value) : undefined })
              }
              onFocus={onFocus}
              placeholder="Max"
            />
          </div>
        </div>
      ) : null}
      <div className="space-y-2">
        <label htmlFor={propertyDescriptionId} className="text-xs opacity-60">
          Description
        </label>
        <Textarea
          id={propertyDescriptionId}
          className="min-h-16 text-xs"
          value={property.description ?? ""}
          onChange={(e) => onUpdate({ description: e.target.value || undefined })}
          onFocus={onFocus}
          placeholder="Describe what this property represents"
        />
      </div>
      {validationType === "enum" && property.type === "string" && (
        <div className="space-y-2">
          <label htmlFor={propertyEnumId} className="text-xs opacity-60">
            Enum values (one per line)
          </label>
          <Textarea
            id={propertyEnumId}
            className="min-h-20 text-xs font-mono"
            value={currentEnumValues}
            onChange={(e) => handleEnumChange(e.target.value)}
            onFocus={onFocus}
            placeholder={propertyItemPlaceholder}
          />
        </div>
      )}
      {validationType === "pattern" && property.type === "string" && (
        <div className="space-y-2">
          <label htmlFor={propertyPatternId} className="text-xs opacity-60">
            Regex pattern
          </label>
          <Input
            id={propertyPatternId}
            className="h-8 text-xs font-mono"
            value={currentPatternValue}
            onChange={(e) => handlePatternChange(e.target.value)}
            onFocus={onFocus}
            placeholder="Regex pattern (e.g., ^[0-9]+$)"
          />
        </div>
      )}
    </div>
  );
}
