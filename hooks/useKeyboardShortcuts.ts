import { useEffect } from "react";

import type { FlowFunctionJson } from "@/lib/schema/flow.schema";
import { useEditorStore } from "@/lib/store/editorStore";
import type { FlowEdge, FlowNode } from "@/lib/types/flowTypes";
import { canDeleteNode, deleteNode } from "@/lib/utils/nodeDeletion";
import { duplicateNode } from "@/lib/utils/nodeDuplication";
import { clearFunctionConnection } from "@/lib/utils/nodeUpdates";

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
 * Hook to handle keyboard shortcuts
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
      // Delete/Backspace for edges and nodes
      if ((e.key === "Delete" || e.key === "Backspace") && !isTyping) {
        e.preventDefault();
        if (selectedNodeId && selectedFunctionIndex !== null) {
          // Delete edge by clearing next_node_id
          setNodes((nds) => clearFunctionConnection(nds, selectedNodeId, selectedFunctionIndex));
          useEditorStore.getState().clearFunctionSelection();
        } else if (selectedNodeId) {
          // Delete node
          const nodeToDelete = nodes.find((n) => n.id === selectedNodeId);
          if (canDeleteNode(nodeToDelete)) {
            setNodes((nds) => deleteNode(nds, selectedNodeId));
            clearSelection();
          }
        }
      } else if (modKey && e.key === "d") {
        // Duplicate node
        e.preventDefault();
        if (selectedNodeId) {
          const selected = nodes.find((n) => n.id === selectedNodeId);
          if (selected && canDeleteNode(selected)) {
            const duplicatedNode = duplicateNode(selected, nodes);
            setNodes((nds) => nds.concat(duplicatedNode));
            selectNode(duplicatedNode.id);
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nodes, selectedNodeId, selectedFunctionIndex, setNodes, clearSelection, selectNode]);
}
