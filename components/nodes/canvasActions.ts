import { createContext, useContext } from "react";

import type { DestinationKind } from "@/lib/utils/nodeCreation";

/** Graph edits a node card can start from its rows and toolbar; provided by the editor shell. */
export interface CanvasActions {
  /** A new function on the node leading to a new node. */
  addDestination: (sourceNodeId: string, kind: DestinationKind) => void;
  /** A new node for a function that has no destination yet. */
  addFunctionDestination: (
    sourceNodeId: string,
    functionIndex: number,
    kind: DestinationKind
  ) => void;
  /** A new case on a branch, leading to a new node. */
  addBranchCase: (sourceNodeId: string, functionIndex: number) => void;
  /** Select a function row, or a case row of a branch (-1 for the default). */
  selectRow: (sourceNodeId: string, functionIndex: number, caseIndex: number | null) => void;
}

export const CanvasActionsContext = createContext<CanvasActions | null>(null);

export function useCanvasActions(): CanvasActions | null {
  return useContext(CanvasActionsContext);
}
