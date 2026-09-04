"use client";

import { Plus } from "lucide-react";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import type { FlowConfigFunction } from "@/lib/schema/flowConfig";
import { useEditorStore } from "@/lib/store/editorStore";

import { FunctionItem } from "./FunctionItem";

type Props = {
  functions: FlowConfigFunction[] | undefined;
  onChange: (functions: FlowConfigFunction[]) => void;
  availableNodeIds: string[];
  currentNodeId?: string;
};

export default function FunctionsForm({
  functions,
  onChange,
  availableNodeIds,
  currentNodeId,
}: Props) {
  const items = functions ?? [];
  const functionRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);
  const selectedFunctionIndex = useEditorStore((state) => state.selectedFunctionIndex);
  const selectedConditionIndex = useEditorStore((state) => state.selectedConditionIndex);
  const scrollTarget = useEditorStore((state) => state.scrollTarget);
  const setScrollTarget = useEditorStore((state) => state.setScrollTarget);
  const selectNode = useEditorStore((state) => state.selectNode);

  // Derive highlighted function index from store for scroll-into-view
  const highlightedFunctionIndex = selectedNodeId === currentNodeId ? selectedFunctionIndex : null;

  const updateItem = (index: number, updates: Partial<FlowConfigFunction>) => {
    const next = [...items];
    next[index] = { ...next[index], ...updates };
    onChange(next);
  };

  const addItem = () => {
    const newIndex = items.length;
    onChange([...items, { name: "" }]);
    // Automatically select and expand the newly added function
    if (currentNodeId) {
      selectNode(currentNodeId, newIndex, null);
    }
  };

  const removeItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    onChange(newItems);
    // Notify parent to adjust selectedFunctionIndex if needed
    // This will be handled by the parent component through the onChange callback
  };

  // Check if we should scroll to a function based on scroll target
  useEffect(() => {
    if (
      scrollTarget &&
      scrollTarget.nodeId === currentNodeId &&
      scrollTarget.functionIndex !== null &&
      scrollTarget.functionIndex === highlightedFunctionIndex
    ) {
      // Scroll target matches this form - scroll to the function
      const element = functionRefs.current.get(scrollTarget.functionIndex);
      if (element) {
        // Use requestAnimationFrame to ensure DOM is ready
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            element.scrollIntoView({ behavior: "smooth", block: "nearest" });
            // Clear scroll target after scrolling
            setScrollTarget(null);
          });
        });
      } else {
        // Element not found yet, try again after a delay
        const timeoutId = setTimeout(() => {
          if (scrollTarget.functionIndex !== null) {
            const retryElement = functionRefs.current.get(scrollTarget.functionIndex);
            if (retryElement) {
              retryElement.scrollIntoView({ behavior: "smooth", block: "nearest" });
              setScrollTarget(null);
            }
          }
        }, 100);
        return () => clearTimeout(timeoutId);
      }
    }
  }, [scrollTarget, currentNodeId, highlightedFunctionIndex, setScrollTarget]);

  const setFunctionRef = (index: number, element: HTMLDivElement | null) => {
    if (element) {
      functionRefs.current.set(index, element);
    } else {
      functionRefs.current.delete(index);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs opacity-60">Functions</div>
        <Button variant="ghost" size="sm" className="h-6 gap-1" onClick={addItem}>
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>
      {items.map((func, i) => (
        <FunctionItem
          key={i}
          ref={(el) => setFunctionRef(i, el)}
          func={func}
          onChange={(updates) => updateItem(i, updates)}
          onRemove={() => removeItem(i)}
          availableNodeIds={availableNodeIds}
          currentNodeId={currentNodeId}
          functionIndex={i}
          isSelected={selectedNodeId === currentNodeId && selectedFunctionIndex === i}
          selectedConditionIndex={
            selectedNodeId === currentNodeId && selectedFunctionIndex === i
              ? selectedConditionIndex
              : null
          }
        />
      ))}
      {items.length === 0 && (
        <div className="text-xs opacity-40 italic py-2">
          No functions. Click "Add" to create one.
        </div>
      )}
    </div>
  );
}
