import { useEffect } from "react";
import type { Edge, Node } from "reactflow";

import { useEditorStore } from "@/lib/store/editorStore";

interface KeyboardShortcutsProps {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  selectedFunctionIndex: number | null;
  setNodes: (updater: (nodes: Node[]) => Node[]) => void;
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
          const node = nodes.find((n) => n.id === selectedNodeId);
          if (node) {
            const functions = ((node.data as any)?.functions as any[] | undefined) ?? [];
            if (functions[selectedFunctionIndex]) {
              setNodes((nds) =>
                nds.map((n) => {
                  if (n.id === selectedNodeId) {
                    const updatedFunctions = [...functions];
                    updatedFunctions[selectedFunctionIndex] = {
                      ...updatedFunctions[selectedFunctionIndex],
                      next_node_id: undefined,
                    };
                    return {
                      ...n,
                      data: {
                        ...n.data,
                        functions: updatedFunctions,
                      },
                    };
                  }
                  return n;
                })
              );
              useEditorStore.getState().clearFunctionSelection();
            }
          }
        } else if (selectedNodeId) {
          // Delete node
          setNodes((nds) => nds.filter((n) => n.id !== selectedNodeId));
          clearSelection();
        }
      } else if (modKey && e.key === "d") {
        // Duplicate node
        e.preventDefault();
        if (selectedNodeId) {
          const selected = nodes.find((n) => n.id === selectedNodeId);
          if (selected) {
            const id = `${selected.type}-${Math.random().toString(36).slice(2, 8)}`;
            const newNode = {
              ...selected,
              id,
              position: { x: selected.position.x + 50, y: selected.position.y + 50 },
            };
            setNodes((nds) => nds.concat(newNode as any));
            selectNode(id);
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nodes, selectedNodeId, selectedFunctionIndex, setNodes, clearSelection, selectNode]);
}
