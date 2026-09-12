/**
 * Flow-level state that has no node to live on: the flow's name (its file
 * name), the YAML document it was opened from, and its global functions.
 */

import type { Document } from "yaml";
import { create } from "zustand";

import { DEFAULT_FLOW_NAME } from "@/lib/document/flowDocument";
import type { FlowConfigFunction } from "@/lib/schema/flowConfig";

export interface LoadedFlow {
  flowName: string;
  /** The parsed document, kept so saves preserve its comments; null for a new flow. */
  document: Document | null;
  globalFunctions: FlowConfigFunction[];
  /**
   * The config's `initial_node` as opened. Written back when no canvas node
   * carries the designation, so a name that resolves to nothing is kept and
   * reported rather than replaced.
   */
  initialNode: string;
}

interface FlowState extends LoadedFlow {
  loadFlow: (flow: LoadedFlow) => void;
  setFlowName: (flowName: string) => void;
  setDocument: (document: Document | null) => void;
  setGlobalFunctions: (globalFunctions: FlowConfigFunction[]) => void;
  setInitialNode: (initialNode: string) => void;
  reset: () => void;
}

const initialState: LoadedFlow = {
  flowName: DEFAULT_FLOW_NAME,
  document: null,
  globalFunctions: [],
  initialNode: "",
};

export const useFlowStore = create<FlowState>((set) => ({
  ...initialState,
  loadFlow: (flow) => set(flow),
  setFlowName: (flowName) => set({ flowName }),
  setDocument: (document) => set({ document }),
  setGlobalFunctions: (globalFunctions) => set({ globalFunctions }),
  setInitialNode: (initialNode) => set({ initialNode }),
  reset: () => set(initialState),
}));
