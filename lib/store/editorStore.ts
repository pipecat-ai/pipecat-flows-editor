import { create } from "zustand";

type Node = any;
type Edge = any;

export interface ScrollTarget {
  nodeId: string;
  functionIndex: number | null;
  conditionIndex: number | null; // -1 for default, 0+ for condition index
}

interface EditorState {
  // Selection state: node ID (string), function index (number), and condition index (number)
  selectedNodeId: string | null;
  selectedFunctionIndex: number | null;
  selectedConditionIndex: number | null; // -1 for default, 0+ for condition index

  // Scroll target for inspector panel
  scrollTarget: ScrollTarget | null;

  // JSON editor state
  showJson: boolean;
  jsonEditorHeight: number;

  // Inspector panel state
  inspectorPanelWidth: number;
  isInspectorResizing: boolean;

  // Code panel state
  isCodePanelResizing: boolean;

  // Nodes panel state
  showNodesPanel: boolean;

  // React Flow instance
  rfInstance: any | null;

  // Internal state for tracking
  _isDeletingFunction: boolean;

  // Basic setters
  setSelectedNodeId: (id: string | null) => void;
  setSelectedFunctionIndex: (index: number | null) => void;
  setSelectedConditionIndex: (index: number | null) => void;
  setScrollTarget: (target: ScrollTarget | null) => void;
  setShowJson: (show: boolean) => void;
  setJsonEditorHeight: (height: number) => void;
  setInspectorPanelWidth: (width: number) => void;
  setIsInspectorResizing: (isResizing: boolean) => void;
  setIsCodePanelResizing: (isResizing: boolean) => void;
  setShowNodesPanel: (show: boolean) => void;
  setRfInstance: (instance: any | null) => void;

  // Selection actions (with validation and logic)
  selectNode: (
    nodeId: string | null,
    functionIndex?: number | null,
    conditionIndex?: number | null
  ) => void;
  selectNodeFromEdge: (edge: Edge, nodes: Node[]) => void;
  selectNodeFromCanvas: (node: Node | null, edge: Edge | null, nodes: Node[]) => void;
  clearSelection: (preserveIfDeleting?: boolean) => void;

  // Function selection (with validation)
  selectFunction: (
    nodeId: string,
    functionIndex: number,
    nodes: Node[],
    conditionIndex?: number | null
  ) => void;
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
    selectedConditionIndex: null,
    scrollTarget: null,
    showJson: false,
    jsonEditorHeight: 400,
    inspectorPanelWidth: 384,
    isInspectorResizing: false,
    isCodePanelResizing: false,
    showNodesPanel: true,
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

    setShowJson: (show) => set({ showJson: show }),
    setJsonEditorHeight: (height) => set({ jsonEditorHeight: height }),
    setInspectorPanelWidth: (width) => set({ inspectorPanelWidth: width }),
    setIsInspectorResizing: (isResizing) => set({ isInspectorResizing: isResizing }),
    setIsCodePanelResizing: (isResizing) => set({ isCodePanelResizing: isResizing }),
    setShowNodesPanel: (show) => set({ showNodesPanel: show }),
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

    selectNodeFromEdge: (edge, nodes) => {
      // Check if this edge leads TO a decision node (from regular node to decision node)
      const targetDecisionNode = nodes.find(
        (n: Node) => n.id === edge.target && n.type === "decision"
      );

      if (targetDecisionNode) {
        // Edge leading to decision node - extract source node and function from decision node ID
        // Decision node ID format: decision-${sourceNodeId}-${functionName}
        const decisionNodeId = targetDecisionNode.id;
        const match = decisionNodeId.match(/^decision-(.+?)-(.+)$/);
        if (match) {
          const [, sourceNodeId, functionName] = match;
          const sourceNode = nodes.find((n: Node) => n.id === sourceNodeId);
          if (sourceNode) {
            const functions = ((sourceNode.data as any)?.functions as any[] | undefined) ?? [];
            const functionIndex = functions.findIndex(
              (f: any) => f.name === functionName && f.decision !== undefined
            );

            if (functionIndex >= 0) {
              // Select the function (no condition, just the function block)
              get().selectNode(sourceNode.id, functionIndex, null);
              return;
            }
          }
        }
      }

      // Check if this edge comes FROM a decision node (condition edges)
      const decisionNode = nodes.find((n: Node) => n.id === edge.source && n.type === "decision");

      if (decisionNode) {
        // Edge from decision node - extract source node and function from decision node ID
        // Decision node ID format: decision-${sourceNodeId}-${functionName}
        const decisionNodeId = decisionNode.id;
        const match = decisionNodeId.match(/^decision-(.+?)-(.+)$/);
        if (match) {
          const [, sourceNodeId, functionName] = match;
          const sourceNode = nodes.find((n: Node) => n.id === sourceNodeId);
          if (sourceNode) {
            const functions = ((sourceNode.data as any)?.functions as any[] | undefined) ?? [];
            const functionIndex = functions.findIndex(
              (f: any) => f.name === functionName && f.decision !== undefined
            );

            if (functionIndex >= 0) {
              const func = functions[functionIndex];
              // Determine condition index from edge ID or label
              // Edge ID format for conditions: edge-${decisionNodeId}-cond-${index}-${target}
              // Edge ID format for default: edge-${decisionNodeId}-default-${target}
              // Edge label for conditions: "result ${operator} ${value}"
              // Edge label for default: "default"
              let conditionIndex: number | null = null;

              if (edge.label === "default") {
                conditionIndex = -1; // -1 indicates default
              } else if (edge.id.includes("-cond-")) {
                // Extract condition index from edge ID
                const condMatch = edge.id.match(/-cond-(\d+)-/);
                if (condMatch) {
                  conditionIndex = parseInt(condMatch[1], 10);
                } else {
                  // Fallback: find by matching target node
                  const condIndex = func.decision.conditions.findIndex(
                    (c: any) => c.next_node_id === edge.target
                  );
                  if (condIndex >= 0) {
                    conditionIndex = condIndex;
                  }
                }
              } else {
                // Fallback: find by matching target node
                const condIndex = func.decision.conditions.findIndex(
                  (c: any) => c.next_node_id === edge.target
                );
                if (condIndex >= 0) {
                  conditionIndex = condIndex;
                }
              }

              get().selectNode(sourceNode.id, functionIndex, conditionIndex);
              return;
            }
          }
        }
      }

      // Regular edge - find function by next_node_id
      const sourceNode = nodes.find((n: Node) => n.id === edge.source);
      if (!sourceNode) return;

      const functions = ((sourceNode.data as any)?.functions as any[] | undefined) ?? [];
      const functionIndex = functions.findIndex(
        (f: any) => f.next_node_id === edge.target && f.name === (edge.label as string)
      );

      if (functionIndex >= 0) {
        get().selectNode(sourceNode.id, functionIndex, null);
      } else {
        get().selectNode(sourceNode.id, null, null);
      }
    },

    selectNodeFromCanvas: (node, edge, nodes) => {
      if (edge) {
        get().selectNodeFromEdge(edge, nodes);
      } else if (node) {
        // Check if this is a decision node
        if (node.type === "decision" && node.data?.sourceNodeId && node.data?.functionName) {
          // Find the source node and function index
          const sourceNode = nodes.find((n: Node) => n.id === node.data.sourceNodeId);
          if (sourceNode) {
            const functions = ((sourceNode.data as any)?.functions as any[] | undefined) ?? [];
            const functionIndex = functions.findIndex(
              (f: any) => f.name === node.data.functionName && f.decision !== undefined
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
      const node = nodes.find((n: Node) => n.id === nodeId);
      if (!node) return;

      const functions = ((node.data as any)?.functions as any[] | undefined) ?? [];
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
