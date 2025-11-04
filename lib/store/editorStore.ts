import { create } from "zustand";

type Node = any;
type Edge = any;

interface EditorState {
  // Selection state: node ID (string) and function index (number)
  selectedNodeId: string | null;
  selectedFunctionIndex: number | null;

  // JSON editor state
  showJson: boolean;
  jsonEditorHeight: number;

  // React Flow instance
  rfInstance: any | null;

  // Internal state for tracking
  _isDeletingFunction: boolean;

  // Basic setters
  setSelectedNodeId: (id: string | null) => void;
  setSelectedFunctionIndex: (index: number | null) => void;
  setShowJson: (show: boolean) => void;
  setJsonEditorHeight: (height: number) => void;
  setRfInstance: (instance: any | null) => void;

  // Selection actions (with validation and logic)
  selectNode: (nodeId: string | null, functionIndex?: number | null) => void;
  selectNodeFromEdge: (edge: Edge, nodes: Node[]) => void;
  selectNodeFromCanvas: (node: Node | null, edge: Edge | null, nodes: Node[]) => void;
  clearSelection: (preserveIfDeleting?: boolean) => void;

  // Function selection (with validation)
  selectFunction: (nodeId: string, functionIndex: number, nodes: Node[]) => void;
  clearFunctionSelection: (preserveIfDeleting?: boolean) => void;

  // Node update helpers (with function index validation)
  validateFunctionIndexAfterUpdate: (
    nodeId: string,
    previousFunctions: any[],
    newFunctions: any[]
  ) => void;

  // Internal helpers
  _setIsDeletingFunction: (value: boolean) => void;
}

export const useEditorStore = create<EditorState>((set, get) => {
  return {
    // Initial state
    selectedNodeId: null,
    selectedFunctionIndex: null,
    showJson: false,
    jsonEditorHeight: 400,
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

    setShowJson: (show) => set({ showJson: show }),
    setJsonEditorHeight: (height) => set({ jsonEditorHeight: height }),
    setRfInstance: (instance) => set({ rfInstance: instance }),

    // Selection actions with validation
    selectNode: (nodeId, functionIndex = null) => {
      const current = get();
      if (current.selectedNodeId !== nodeId || current.selectedFunctionIndex !== functionIndex) {
        set({ selectedNodeId: nodeId, selectedFunctionIndex: functionIndex });
      }
    },

    selectNodeFromEdge: (edge, nodes) => {
      const sourceNode = nodes.find((n: Node) => n.id === edge.source);
      if (!sourceNode) return;

      const functions = ((sourceNode.data as any)?.functions as any[] | undefined) ?? [];
      const functionIndex = functions.findIndex(
        (f: any) => f.next_node_id === edge.target && f.name === (edge.label as string)
      );

      if (functionIndex >= 0) {
        get().selectNode(sourceNode.id, functionIndex);
      } else {
        get().selectNode(sourceNode.id, null);
      }
    },

    selectNodeFromCanvas: (node, edge, nodes) => {
      if (edge) {
        get().selectNodeFromEdge(edge, nodes);
      } else if (node) {
        const current = get();
        // Only update if node changed (clear function index when switching nodes)
        if (current.selectedNodeId !== node.id) {
          get().selectNode(node.id, null);
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
      if (state.selectedNodeId !== null || state.selectedFunctionIndex !== null) {
        set({ selectedNodeId: null, selectedFunctionIndex: null });
      }
    },

    // Function selection with validation
    selectFunction: (nodeId, functionIndex, nodes) => {
      const node = nodes.find((n: Node) => n.id === nodeId);
      if (!node) return;

      const functions = ((node.data as any)?.functions as any[] | undefined) ?? [];
      // Validate function index
      if (functionIndex >= 0 && functionIndex < functions.length) {
        get().selectNode(nodeId, functionIndex);
      } else {
        get().selectNode(nodeId, null);
      }
    },

    clearFunctionSelection: (preserveIfDeleting = false) => {
      const state = get();
      if (preserveIfDeleting && state._isDeletingFunction) {
        return;
      }
      if (state.selectedFunctionIndex !== null) {
        set({ selectedFunctionIndex: null });
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
