import { createContext, useContext } from "react";

import type { DestinationKind } from "@/lib/utils/nodeCreation";

/** Graph edits a node can start from its own toolbar; provided by the editor shell. */
export interface CanvasActions {
  addDestination: (sourceNodeId: string, kind: DestinationKind) => void;
  addBranchCase: (branchNodeId: string) => void;
}

export const CanvasActionsContext = createContext<CanvasActions | null>(null);

export function useCanvasActions(): CanvasActions | null {
  return useContext(CanvasActionsContext);
}
