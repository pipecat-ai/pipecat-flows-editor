"use client";

import { ArrowRight, LogOut, Plus, Split, Wrench } from "lucide-react";
import { useState } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DestinationKind } from "@/lib/utils/nodeCreation";

/** Where a new function leads. Every function is a tool call; the kinds differ only in the destination. */
const DESTINATIONS: {
  kind: DestinationKind;
  label: string;
  description: string;
  Icon: typeof ArrowRight;
}[] = [
  {
    kind: "node",
    label: "Next node",
    description: "A function that leads to a new node",
    Icon: ArrowRight,
  },
  {
    kind: "stay",
    label: "Stay on this node",
    description: "A function that does work here",
    Icon: Wrench,
  },
  {
    kind: "branch",
    label: "Branch on the result",
    description: "A function whose result picks the next node",
    Icon: Split,
  },
  {
    kind: "end",
    label: "End",
    description: "A function that leads to the end of the conversation",
    Icon: LogOut,
  },
];

/** What a new function can lead to, as a dropdown around any trigger. */
export function DestinationMenu({
  trigger,
  onAdd,
  onOpenChange,
}: {
  trigger: React.ReactNode;
  onAdd: (kind: DestinationKind) => void;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="center" side="bottom" className="nodrag nopan">
        {DESTINATIONS.map(({ kind, label, description, Icon }) => (
          <DropdownMenuItem key={kind} onClick={() => onAdd(kind)} className="items-start gap-2">
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="flex flex-col">
              <span>{label}</span>
              <span className="text-[11px] text-neutral-500">{description}</span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface Props {
  visible: boolean;
  onAdd: (kind: DestinationKind) => void;
  title: string;
}

/**
 * The "+" under a card, the one place to add a function. It is part of the
 * card, so it scales with the canvas and hovering it is hovering the card.
 * Shown while the card is hovered or selected, or its menu is open.
 */
export default function NodeAddToolbar({ visible, onAdd, title }: Props) {
  const [open, setOpen] = useState(false);
  const shown = visible || open;

  return (
    <div
      className={`absolute left-1/2 top-full z-10 -translate-x-1/2 pt-2 transition-opacity ${
        shown ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <DestinationMenu
        onAdd={onAdd}
        onOpenChange={setOpen}
        trigger={
          <button
            type="button"
            className="nodrag nopan flex h-8 w-8 items-center justify-center rounded-md border border-neutral-300 bg-white text-neutral-600 shadow-sm hover:border-blue-500 hover:text-blue-600 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
            title={title}
            aria-label={title}
          >
            <Plus className="h-5 w-5" />
          </button>
        }
      />
    </div>
  );
}
