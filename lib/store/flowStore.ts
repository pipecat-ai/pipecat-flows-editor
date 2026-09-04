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
}

interface FlowState extends LoadedFlow {
  loadFlow: (flow: LoadedFlow) => void;
  setFlowName: (flowName: string) => void;
  setDocument: (document: Document | null) => void;
  setGlobalFunctions: (globalFunctions: FlowConfigFunction[]) => void;
  reset: () => void;
}

const initialState: LoadedFlow = {
  flowName: DEFAULT_FLOW_NAME,
  document: null,
  globalFunctions: [],
};

export const useFlowStore = create<FlowState>((set) => ({
  ...initialState,
  loadFlow: (flow) => set(flow),
  setFlowName: (flowName) => set({ flowName }),
  setDocument: (document) => set({ document }),
  setGlobalFunctions: (globalFunctions) => set({ globalFunctions }),
  reset: () => set(initialState),
}));
