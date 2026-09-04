"use client";

import { NodeToolbar, Position } from "@xyflow/react";
import { GitBranch, LogOut, Plus, SquarePlus } from "lucide-react";
import { useState } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DestinationKind } from "@/lib/utils/nodeCreation";

const DESTINATIONS: { kind: DestinationKind; label: string; Icon: typeof SquarePlus }[] = [
  { kind: "node", label: "Next node", Icon: SquarePlus },
  { kind: "end", label: "End", Icon: LogOut },
  { kind: "branch", label: "Branch on the result", Icon: GitBranch },
];

/** The three kinds of destination, as a dropdown around any trigger. */
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
        {DESTINATIONS.map(({ kind, label, Icon }) => (
          <DropdownMenuItem key={kind} onClick={() => onAdd(kind)}>
            <Icon className="mr-2 h-4 w-4" />
            {label}
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
  onHoverChange: (hovering: boolean) => void;
}

/** A "+" under a node that adds a function leading to a new node. Shown on hover and while selected. */
export default function NodeAddToolbar({ visible, onAdd, title, onHoverChange }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <NodeToolbar
      isVisible={visible || open}
      position={Position.Bottom}
      offset={4}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
    >
      <DestinationMenu
        onAdd={onAdd}
        onOpenChange={setOpen}
        trigger={
          <button
            type="button"
            className="nodrag nopan flex h-7 w-7 items-center justify-center rounded-full border border-neutral-300 bg-white text-neutral-600 shadow-sm hover:border-blue-500 hover:text-blue-600 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
            title={title}
            aria-label={title}
          >
            <Plus className="h-4 w-4" />
          </button>
        }
      />
    </NodeToolbar>
  );
}
