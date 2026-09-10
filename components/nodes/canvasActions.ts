import { createContext, useContext } from "react";

import type { DestinationKind } from "@/lib/utils/nodeCreation";

/**
 * Graph edits a node card can start from its rows and toolbar; provided by
 * the editor shell. The canvas owns structure: which nodes and functions
 * exist and where they lead. The inspector owns the rest.
 */
export interface CanvasActions {
  /** A new function on the node, leading to a new node or staying. Returns its index. */
  addDestination: (sourceNodeId: string, kind: DestinationKind) => number | null;
  /** A new case on a branch, leading to a new node. */
  addBranchCase: (sourceNodeId: string, functionIndex: number) => void;
  removeFunction: (nodeId: string, functionIndex: number) => void;
  removeBranchCase: (nodeId: string, functionIndex: number, caseIndex: number) => void;
  /** Rename with the tool-name rules applied; an invalid name is ignored. */
  renameFunction: (nodeId: string, functionIndex: number, name: string) => void;
  renameBranchCase: (
    nodeId: string,
    functionIndex: number,
    oldValue: string,
    newValue: string
  ) => void;
  /** The field of the tool result a branch keys on. */
  setBranchField: (nodeId: string, functionIndex: number, field: string) => void;
  /** Rename the node; the name is made a valid, unique key and every destination follows. */
  renameNode: (nodeId: string, name: string) => void;
  /** Select a function row, or a case row of a branch (-1 for the default). */
  selectRow: (sourceNodeId: string, functionIndex: number, caseIndex: number | null) => void;
}

export const CanvasActionsContext = createContext<CanvasActions | null>(null);

export function useCanvasActions(): CanvasActions | null {
  return useContext(CanvasActionsContext);
}
