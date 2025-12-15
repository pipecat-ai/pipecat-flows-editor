"use client";

import { Copy, Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

interface NodeContextMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  position: { x: number; y: number } | null;
  onDuplicate: () => void;
  onDelete: () => void;
  isDecisionNode?: boolean;
}

export default function NodeContextMenu({
  open,
  onOpenChange,
  position,
  onDuplicate,
  onDelete,
  isDecisionNode = false,
}: NodeContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onOpenChange(false);
      }
    };

    // Use setTimeout to avoid immediate closure when right-clicking
    const timeoutId = setTimeout(() => {
      document.addEventListener("click", handleClickOutside);
      document.addEventListener("contextmenu", handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("click", handleClickOutside);
      document.removeEventListener("contextmenu", handleClickOutside);
    };
  }, [open, onOpenChange]);

  // Close menu on escape key
  useEffect(() => {
    if (!open) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onOpenChange]);

  if (!open || !position) return null;

  // Decision nodes shouldn't be duplicated or deleted directly
  // They're managed automatically by the useDecisionNodes hook
  if (isDecisionNode) {
    return null;
  }

  const handleDuplicate = () => {
    onDuplicate();
    onOpenChange(false);
  };

  const handleDelete = () => {
    onDelete();
    onOpenChange(false);
  };

  const menuContent = (
    <div
      ref={menuRef}
      className={cn(
        "z-50 min-w-32 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
        "animate-in fade-in-0 zoom-in-95"
      )}
      style={{
        position: "fixed",
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <button
        onClick={handleDuplicate}
        className={cn(
          "relative flex w-full cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none",
          "transition-colors focus:bg-accent focus:text-accent-foreground",
          "hover:bg-accent hover:text-accent-foreground"
        )}
      >
        <Copy className="h-4 w-4" />
        Duplicate
      </button>
      <button
        onClick={handleDelete}
        className={cn(
          "relative flex w-full cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none",
          "transition-colors focus:bg-accent focus:text-accent-foreground",
          "hover:bg-accent hover:text-accent-foreground",
          "text-destructive focus:text-destructive"
        )}
      >
        <Trash2 className="h-4 w-4" />
        Delete
      </button>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(menuContent, document.body) : null;
}
