import { create } from "zustand";

import {
  type CanvasEdge,
  type CanvasNode,
  isBranchNode,
  nodeFunctions,
} from "@/lib/convert/configToCanvas";
import type { FlowConfigFunction } from "@/lib/schema/flowConfig";
import type { ReactFlowInstance } from "@/lib/types/flowTypes";

export interface ScrollTarget {
  nodeId: string;
  functionIndex: number | null;
  conditionIndex: number | null; // -1 for the branch default, 0+ for a case index
}

interface EditorState {
  // Selection: a node, a function on it, and a case of that function's branch table
  selectedNodeId: string | null;
  selectedFunctionIndex: number | null;
  selectedConditionIndex: number | null; // -1 for the branch default, 0+ for a case index

  // Scroll target for inspector panel
  scrollTarget: ScrollTarget | null;

  // YAML pane state
  showYaml: boolean;
  yamlPanelHeight: number;
  isYamlPanelResizing: boolean;

  // Inspector panel state
  inspectorPanelWidth: number;
  isInspectorResizing: boolean;

  // Flow panel: the inspector's flow-level view, shown when no node is selected
  showFlowPanel: boolean;

  // React Flow instance
  rfInstance: ReactFlowInstance | null;

  // Internal state for tracking
  _isDeletingFunction: boolean;

  // Basic setters
  setSelectedNodeId: (id: string | null) => void;
  setSelectedFunctionIndex: (index: number | null) => void;
  setSelectedConditionIndex: (index: number | null) => void;
  setScrollTarget: (target: ScrollTarget | null) => void;
  setShowYaml: (show: boolean) => void;
  setYamlPanelHeight: (height: number) => void;
  setIsYamlPanelResizing: (isResizing: boolean) => void;
  setInspectorPanelWidth: (width: number) => void;
  setIsInspectorResizing: (isResizing: boolean) => void;
  setShowFlowPanel: (show: boolean) => void;
  setRfInstance: (instance: ReactFlowInstance | null) => void;

  // Selection actions (with validation and logic)
  selectNode: (
    nodeId: string | null,
    functionIndex?: number | null,
    conditionIndex?: number | null
  ) => void;
  selectNodeFromEdge: (edge: CanvasEdge, nodes: CanvasNode[]) => void;
  selectNodeFromCanvas: (
    node: CanvasNode | null,
    edge: CanvasEdge | null,
    nodes: CanvasNode[]
  ) => void;
  clearSelection: (preserveIfDeleting?: boolean) => void;

  // Function selection (with validation)
  selectFunction: (
    nodeId: string,
    functionIndex: number,
    nodes: CanvasNode[],
    conditionIndex?: number | null
  ) => void;
  clearFunctionSelection: (preserveIfDeleting?: boolean) => void;

  // Node update helpers (with function index validation)
  validateFunctionIndexAfterUpdate: (
    nodeId: string,
    previousFunctions: FlowConfigFunction[],
    newFunctions: FlowConfigFunction[]
  ) => void;

  // Internal helpers
  _setIsDeletingFunction: (value: boolean) => void;
}

export const useEditorStore = create<EditorState>((set, get) => {
  return {
    // Initial state
    selectedNodeId: null,
    selectedFunctionIndex: null,
    selectedConditionIndex: null,
    scrollTarget: null,
    showYaml: false,
    yamlPanelHeight: 360,
    isYamlPanelResizing: false,
    inspectorPanelWidth: 384,
    isInspectorResizing: false,
    showFlowPanel: false,
    rfInstance: null,
    _isDeletingFunction: false,

    // Basic setters
    setSelectedNodeId: (id) => {
      const current = get().selectedNodeId;
      if (current !== id) {
        set({ selectedNodeId: id });
      }
    },

    setSelectedFunctionIndex: (index) => {
      const current = get().selectedFunctionIndex;
      if (current !== index) {
        set({ selectedFunctionIndex: index });
      }
    },

    setSelectedConditionIndex: (index) => {
      const current = get().selectedConditionIndex;
      if (current !== index) {
        set({ selectedConditionIndex: index });
      }
    },

    setScrollTarget: (target) => {
      set({ scrollTarget: target });
    },

    setShowYaml: (show) => set({ showYaml: show }),
    setYamlPanelHeight: (height) => set({ yamlPanelHeight: height }),
    setIsYamlPanelResizing: (isResizing) => set({ isYamlPanelResizing: isResizing }),
    setInspectorPanelWidth: (width) => set({ inspectorPanelWidth: width }),
    setIsInspectorResizing: (isResizing) => set({ isInspectorResizing: isResizing }),
    setShowFlowPanel: (show) => set({ showFlowPanel: show }),
    setRfInstance: (instance) => set({ rfInstance: instance }),

    // Selection actions with validation
    selectNode: (nodeId, functionIndex = null, conditionIndex = null) => {
      const current = get();
      if (
        current.selectedNodeId !== nodeId ||
        current.selectedFunctionIndex !== functionIndex ||
        current.selectedConditionIndex !== conditionIndex
      ) {
        // Set scroll target when selecting a node (only if nodeId is not null)
        set({
          selectedNodeId: nodeId,
          selectedFunctionIndex: functionIndex,
          selectedConditionIndex: conditionIndex,
          scrollTarget:
            nodeId !== null
              ? {
                  nodeId,
                  functionIndex: functionIndex ?? null,
                  conditionIndex: conditionIndex ?? null,
                }
              : null,
        });
      }
    },

    // An edge stands for a function entry (see CanvasEdgeData); selecting it
    // selects that function, and for a branch edge the case it came from.
    selectNodeFromEdge: (edge, nodes) => {
      const data = edge.data;
      if (!data) {
        get().selectNode(edge.source, null, null);
        return;
      }
      const sourceNode = nodes.find((n) => n.id === data.sourceNodeId);
      if (!sourceNode) return;
      const functionIndex = nodeFunctions(sourceNode).findIndex(
        (fn) => fn.name === data.functionName
      );
      if (functionIndex < 0) {
        get().selectNode(sourceNode.id, null, null);
        return;
      }
      switch (data.kind) {
        case "case":
          get().selectNode(sourceNode.id, functionIndex, data.caseIndex ?? null);
          break;
        case "default":
          get().selectNode(sourceNode.id, functionIndex, -1);
          break;
        default:
          get().selectNode(sourceNode.id, functionIndex, null);
      }
    },

    selectNodeFromCanvas: (node, edge, nodes) => {
      if (edge) {
        get().selectNodeFromEdge(edge, nodes);
      } else if (node) {
        if (isBranchNode(node)) {
          // A branch node stands for a function on its source node
          const sourceNode = nodes.find((n) => n.id === node.data.sourceNodeId);
          if (sourceNode) {
            const functionIndex = nodeFunctions(sourceNode).findIndex(
              (fn) => fn.name === node.data.functionName
            );
            if (functionIndex >= 0) {
              get().selectFunction(sourceNode.id, functionIndex, nodes, null);
            } else {
              get().selectNode(sourceNode.id, null, null);
            }
          }
        } else {
          // Regular node selection
          const current = get();
          // Only update if node changed (clear function index when switching nodes)
          if (current.selectedNodeId !== node.id) {
            get().selectNode(node.id, null);
          }
        }
      } else {
        // Selection cleared - check if we should preserve (deleting function case)
        const state = get();
        if (!state._isDeletingFunction) {
          get().clearSelection();
        }
      }
    },

    clearSelection: (preserveIfDeleting = false) => {
      const state = get();
      if (preserveIfDeleting && state._isDeletingFunction) {
        return; // Preserve selection during function deletion
      }
      if (
        state.selectedNodeId !== null ||
        state.selectedFunctionIndex !== null ||
        state.selectedConditionIndex !== null
      ) {
        set({ selectedNodeId: null, selectedFunctionIndex: null, selectedConditionIndex: null });
      }
    },

    // Function selection with validation
    selectFunction: (nodeId, functionIndex, nodes, conditionIndex = null) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;

      const functions = nodeFunctions(node);
      // Validate function index
      if (functionIndex >= 0 && functionIndex < functions.length) {
        get().selectNode(nodeId, functionIndex, conditionIndex);
      } else {
        get().selectNode(nodeId, null, conditionIndex);
      }
    },

    clearFunctionSelection: (preserveIfDeleting = false) => {
      const state = get();
      if (preserveIfDeleting && state._isDeletingFunction) {
        return;
      }
      if (state.selectedFunctionIndex !== null || state.selectedConditionIndex !== null) {
        set({ selectedFunctionIndex: null, selectedConditionIndex: null });
      }
    },

    // Validate and adjust function index after node update
    validateFunctionIndexAfterUpdate: (nodeId, previousFunctions, newFunctions) => {
      const state = get();
      if (nodeId !== state.selectedNodeId || state.selectedFunctionIndex === null) {
        return; // Not the selected node or no function selected
      }

      const oldCount = previousFunctions.length;
      const newCount = newFunctions.length;

      // If functions were deleted and selected index is out of bounds
      if (newCount < oldCount && state.selectedFunctionIndex >= newCount) {
        // Set flag to preserve selection when edge disappears
        set({ _isDeletingFunction: true });
        setTimeout(() => {
          set({ _isDeletingFunction: false });
        }, 100);
        // Clear function index but keep node selected
        set({ selectedFunctionIndex: null });
      }
    },

    // Internal helper
    _setIsDeletingFunction: (value) => set({ _isDeletingFunction: value }),
  };
});
