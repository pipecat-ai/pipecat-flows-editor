import { useEffect } from "react";

import { useEditorStore } from "@/lib/store/editorStore";
import type { FlowEdge, FlowNode } from "@/lib/types/flowTypes";
import { canDeleteNode, deleteNode } from "@/lib/utils/nodeDeletion";
import { canDuplicateNode, duplicateNode } from "@/lib/utils/nodeDuplication";
import { removeBranchCase, removeEdgeRoute, removeFunction } from "@/lib/utils/nodeUpdates";

interface KeyboardShortcutsProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
  selectedNodeId: string | null;
  selectedFunctionIndex: number | null;
  setNodes: (updater: (nodes: FlowNode[]) => FlowNode[]) => void;
  clearSelection: () => void;
  selectNode: (nodeId: string | null, functionIndex?: number | null) => void;
}

/**
 * Delete removes what is selected: a selected edge loses its route, a
 * selected row (function, case, or default) is removed, and otherwise the
 * selected node is deleted. Cmd/Ctrl+D duplicates the selected node.
 */
export function useKeyboardShortcuts({
  nodes,
  edges,
  selectedNodeId,
  selectedFunctionIndex,
  setNodes,
  clearSelection,
  selectNode,
}: KeyboardShortcutsProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;
      const target = e.target as HTMLElement | null;
      const isTyping =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable ||
          target.closest("[data-monaco-editor]") !== null);

      // Undo/Redo handled by Toolbar component, not here
      if ((e.key === "Delete" || e.key === "Backspace") && !isTyping) {
        e.preventDefault();
        const selectedEdges = edges.filter((edge) => edge.selected);
        if (selectedEdges.length > 0) {
          setNodes((nds) => selectedEdges.reduce((acc, edge) => removeEdgeRoute(acc, edge), nds));
          useEditorStore.getState().clearFunctionSelection();
        } else if (selectedNodeId && selectedFunctionIndex !== null) {
          const conditionIndex = useEditorStore.getState().selectedConditionIndex;
          setNodes((nds) =>
            conditionIndex !== null
              ? removeBranchCase(nds, selectedNodeId, selectedFunctionIndex, conditionIndex)
              : removeFunction(nds, selectedNodeId, selectedFunctionIndex)
          );
          useEditorStore.getState().clearFunctionSelection();
        } else if (selectedNodeId) {
          const nodeToDelete = nodes.find((n) => n.id === selectedNodeId);
          if (canDeleteNode(nodeToDelete)) {
            setNodes((nds) => deleteNode(nds, selectedNodeId));
            clearSelection();
          }
        }
      } else if (modKey && e.key === "d") {
        e.preventDefault();
        if (selectedNodeId) {
          const selected = nodes.find((n) => n.id === selectedNodeId);
          if (canDuplicateNode(selected)) {
            const duplicatedNode = duplicateNode(selected, nodes);
            setNodes((nds) => nds.concat(duplicatedNode));
            selectNode(duplicatedNode.id);
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nodes, edges, selectedNodeId, selectedFunctionIndex, setNodes, clearSelection, selectNode]);
}
