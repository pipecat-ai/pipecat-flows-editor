"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { Background, Controls, MiniMap, ReactFlow, useEdgesState, useNodesState } from "reactflow";
import "reactflow/dist/style.css";
import { loadCurrent, saveCurrent } from "@/lib/storage/localStore";
import NodePalette from "@/components/palette/NodePalette";
import { getTemplateByType } from "@/lib/nodes/templates";
import { generateNodeIdFromLabel } from "@/lib/utils/nodeId";
import { deriveNodeType } from "@/lib/utils/nodeType";
import InspectorPanel from "@/components/inspector/InspectorPanel";
import Toolbar from "@/components/header/Toolbar";
import JsonEditor from "@/components/json/JsonEditor";
import { UndoManager } from "@/lib/undo/undoManager";
import ToastContainer from "@/components/ui/Toast";
import { Button } from "@/components/ui/button";
import { useEditorStore } from "@/lib/store/editorStore";
import BaseNode from "@/components/nodes/BaseNode";

function useInitialGraph() {
  return useMemo(() => {
    const initialId = generateNodeIdFromLabel("Initial", []);
    const initialData = {
      label: "Initial",
      type: "initial",
      role_messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant. You must ALWAYS use the available functions to progress the conversation.",
        },
      ],
      task_messages: [
        {
          role: "system",
          content: "Greet the user and guide them through the conversation.",
        },
      ],
      functions: [],
    };
    const initialType = deriveNodeType(initialData, "initial");
    return {
      nodes: [
        {
          id: initialId,
          position: { x: 100, y: 100 },
          data: { ...initialData, type: initialType },
          type: initialType,
        },
      ] as any,
      edges: [],
    };
  }, []);
}

export default function EditorShell() {
  const initial = useInitialGraph();
  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);

  // Use Zustand store for UI state with proper selectors
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);
  const selectedFunctionIndex = useEditorStore((state) => state.selectedFunctionIndex);
  const showJson = useEditorStore((state) => state.showJson);
  const jsonEditorHeight = useEditorStore((state) => state.jsonEditorHeight);
  const rfInstance = useEditorStore((state) => state.rfInstance);
  const setShowJson = useEditorStore((state) => state.setShowJson);
  const setJsonEditorHeight = useEditorStore((state) => state.setJsonEditorHeight);
  const setRfInstance = useEditorStore((state) => state.setRfInstance);
  const selectNode = useEditorStore((state) => state.selectNode);
  const selectNodeFromCanvas = useEditorStore((state) => state.selectNodeFromCanvas);
  const validateFunctionIndexAfterUpdate = useEditorStore(
    (state) => state.validateFunctionIndexAfterUpdate
  );
  const clearSelection = useEditorStore((state) => state.clearSelection);

  const undoManagerRef = useRef(new UndoManager({ nodes: initial.nodes, edges: initial.edges }));
  const skipUndoPushRef = useRef(false);

  // Memoize nodeTypes to avoid recreating on every render
  const nodeTypes = useMemo(
    () => ({
      initial: BaseNode,
      llm_task: BaseNode,
      end: BaseNode,
    }),
    []
  );

  // Helper: Update node data and validate function index
  const updateNodeData = useCallback(
    (nodeId: string, updates: Partial<any>, previousFunctions?: any[]) => {
      const newFunctions = updates.functions as any[] | undefined;

      // Update nodes
      setNodes((nds) => {
        return nds.map((n) => {
          if (n.id === nodeId) {
            const newData = { ...n.data, ...updates };
            // Derive node type from updated data (especially post_actions)
            const derivedType = deriveNodeType(newData, n.type as string);
            return { ...n, type: derivedType, data: newData };
          }
          return n;
        });
      });

      // Validate function index after update (store handles all logic)
      if (previousFunctions !== undefined && newFunctions !== undefined) {
        validateFunctionIndexAfterUpdate(nodeId, previousFunctions, newFunctions);
      }
    },
    [setNodes, validateFunctionIndexAfterUpdate]
  );

  // load current on mount if present
  useEffect(() => {
    const saved = loadCurrent<{ nodes: any[]; edges: any[] }>();
    if (saved?.nodes && saved?.edges) {
      setNodes(saved.nodes as any);
      setEdges(saved.edges as any);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Derive edges from functions whenever nodes change (structure only, not selection)
  useEffect(() => {
    const derivedEdges: any[] = [];
    nodes.forEach((node) => {
      const functions = ((node.data as any)?.functions as any[] | undefined) ?? [];
      functions.forEach((func) => {
        if (func.next_node_id && func.name) {
          const edgeId = `func-${node.id}-${func.name}-${func.next_node_id}`;
          derivedEdges.push({
            id: edgeId,
            source: node.id,
            target: func.next_node_id,
            label: func.name,
            type: "default", // Use default bezier curves for natural-looking edges
            selected: false, // Selection will be updated separately
            style: undefined, // Style will be updated separately
          });
        }
      });
    });

    // Always update edges to ensure they're rendered
    // The setEdges function will handle deduplication internally
    setEdges((currentEdges) => {
      // Quick check: if lengths differ, structure changed
      if (currentEdges.length !== derivedEdges.length) {
        return derivedEdges;
      }

      // Check if any edge was added or removed
      const currentIds = new Set(currentEdges.map((e) => e.id));
      const derivedIds = new Set(derivedEdges.map((e) => e.id));

      if (
        currentIds.size !== derivedIds.size ||
        ![...currentIds].every((id) => derivedIds.has(id))
      ) {
        return derivedEdges;
      }

      // Structure unchanged, preserve current edges (including selection state)
      return currentEdges;
    });
  }, [nodes, setEdges]);

  // Keep selected node visually selected in React Flow (separate effect to avoid loops)
  // Only update when selectedNodeId changes, NOT when selectedFunctionIndex changes
  const prevSelectedNodeId = useRef<string | null>(null);
  useEffect(() => {
    if (selectedNodeId && rfInstance && prevSelectedNodeId.current !== selectedNodeId) {
      prevSelectedNodeId.current = selectedNodeId;
      // Use setTimeout to avoid updating during render
      const timer = setTimeout(() => {
        rfInstance.setNodes((nds: any[]) =>
          nds.map((node: any) => ({
            ...node,
            selected: node.id === selectedNodeId,
          }))
        );
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [selectedNodeId, rfInstance]);

  // autosave debounced
  useEffect(() => {
    const id = setTimeout(() => {
      saveCurrent({ nodes, edges });
    }, 400);
    return () => clearTimeout(id);
  }, [nodes, edges]);

  // push to undo history on changes (debounced, skip if from undo/redo)
  useEffect(() => {
    if (skipUndoPushRef.current) {
      skipUndoPushRef.current = false;
      return;
    }
    const id = setTimeout(() => {
      undoManagerRef.current.push({ nodes: nodes as any, edges: edges as any });
    }, 200);
    return () => clearTimeout(id);
  }, [nodes, edges]);

  // keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;
      const target = e.target as HTMLElement | null;
      const isTyping =
        !!target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

      if (modKey && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        const state = undoManagerRef.current.undo();
        if (state) {
          skipUndoPushRef.current = true;
          setNodes(state.nodes as any);
          setEdges(state.edges as any);
        }
      } else if ((modKey && e.key === "z" && e.shiftKey) || (modKey && e.key === "y")) {
        e.preventDefault();
        const state = undoManagerRef.current.redo();
        if (state) {
          skipUndoPushRef.current = true;
          setNodes(state.nodes as any);
          setEdges(state.edges as any);
        }
      } else if ((e.key === "Delete" || e.key === "Backspace") && !isTyping) {
        e.preventDefault();
        // Check if we have a selected edge (via selectedFunctionIndex)
        if (selectedNodeId && selectedFunctionIndex !== null) {
          // Delete the edge by removing the function's next_node_id
          const node = nodes.find((n) => n.id === selectedNodeId);
          if (node) {
            const functions = ((node.data as any)?.functions as any[] | undefined) ?? [];
            if (functions[selectedFunctionIndex]) {
              const updatedFunctions = [...functions];
              updatedFunctions[selectedFunctionIndex] = {
                ...updatedFunctions[selectedFunctionIndex],
                next_node_id: undefined,
              };

              setNodes((nds) =>
                nds.map((n) =>
                  n.id === selectedNodeId
                    ? {
                        ...n,
                        data: {
                          ...n.data,
                          functions: updatedFunctions,
                        },
                      }
                    : n
                )
              );

              // Clear function highlight but keep inspector open
              const clearFunctionSelection = useEditorStore.getState().clearFunctionSelection;
              clearFunctionSelection();
            }
          }
        } else if (selectedNodeId) {
          // Delete the entire node
          setNodes((nds) => nds.filter((n) => n.id !== selectedNodeId));
          clearSelection();
        }
      } else if (modKey && e.key === "d") {
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
  }, [
    clearSelection,
    edges,
    nodes,
    selectedFunctionIndex,
    selectedNodeId,
    selectNode,
    setEdges,
    setNodes,
  ]);

  return (
    <div className="h-screen w-screen flex overflow-hidden">
      <div
        className="flex flex-col overflow-hidden"
        style={{ height: `calc(100vh - ${showJson ? jsonEditorHeight : 0}px)` }}
      >
        <NodePalette nodes={nodes as any} />
      </div>
      <Toolbar
        nodes={nodes as any}
        edges={edges as any}
        setNodes={setNodes as any}
        setEdges={setEdges as any}
        canUndo={undoManagerRef.current.canUndo()}
        canRedo={undoManagerRef.current.canRedo()}
        onUndo={() => {
          const state = undoManagerRef.current.undo();
          if (state) {
            skipUndoPushRef.current = true;
            setNodes(state.nodes as any);
            setEdges(state.edges as any);
          }
        }}
        onRedo={() => {
          const state = undoManagerRef.current.redo();
          if (state) {
            skipUndoPushRef.current = true;
            setNodes(state.nodes as any);
            setEdges(state.edges as any);
          }
        }}
        onNewFlow={() => {
          // Reset to initial graph
          skipUndoPushRef.current = true;
          setNodes(initial.nodes as any);
          setEdges(initial.edges as any);
          undoManagerRef.current = new UndoManager({
            nodes: initial.nodes,
            edges: initial.edges,
          });
          clearSelection();
          // Center the view after a short delay to ensure nodes are rendered
          setTimeout(() => {
            if (rfInstance) {
              rfInstance.fitView({ padding: 0.2, duration: 300 });
            }
          }, 100);
        }}
      />
      <div
        className="flex-1 min-w-0 relative"
        style={{ height: `calc(100vh - ${showJson ? jsonEditorHeight : 0}px)` }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={(params) => {
            // When connecting nodes, create a function in the source node instead of an edge
            const sourceNode = nodes.find((n) => n.id === params.source);
            if (sourceNode) {
              const functions = ((sourceNode.data as any)?.functions as any[] | undefined) ?? [];
              const existingFunctionNames = functions.map((f) => f.name).filter(Boolean);
              const defaultFunctionName = `function_${existingFunctionNames.length + 1}`;

              // Generate a valid function name
              const functionName = generateNodeIdFromLabel(
                defaultFunctionName,
                existingFunctionNames
              );

              const newFunction = {
                name: functionName,
                description: "",
                next_node_id: params.target,
              };

              // Update nodes with the new function
              setNodes((nds) =>
                nds.map((n) =>
                  n.id === params.source
                    ? {
                        ...n,
                        data: {
                          ...n.data,
                          functions: [...functions, newFunction],
                        },
                      }
                    : n
                )
              );

              // Select the source node and function after state update
              selectNode(params.source, functions.length);

              // Also update React Flow selection to ensure the node is visually selected
              setTimeout(() => {
                if (rfInstance) {
                  rfInstance.setNodes((nodes: any[]) =>
                    nodes.map((node) => ({
                      ...node,
                      selected: node.id === params.source,
                    }))
                  );
                }
              }, 0);
            }
          }}
          onSelectionChange={(sel) => {
            const n = sel.nodes?.[0] || null;
            const e = sel.edges?.[0] || null;
            // Store handles all selection logic and validation
            selectNodeFromCanvas(n, e, nodes);
          }}
          snapToGrid={true}
          snapGrid={[20, 20]}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
          }}
          onDrop={(e) => {
            e.preventDefault();
            const type = e.dataTransfer.getData("application/x-node-type");
            if (!type) return;

            // Prevent adding more than one initial node
            if (type === "initial") {
              const hasInitialNode = nodes.some(
                (n) => deriveNodeType(n.data, n.type as string) === "initial"
              );
              if (hasInitialNode) {
                return;
              }
            }

            const bounds = (e.target as HTMLElement).getBoundingClientRect();
            const position = rfInstance?.project
              ? rfInstance.project({ x: e.clientX - bounds.left, y: e.clientY - bounds.top })
              : { x: e.clientX - bounds.left, y: e.clientY - bounds.top };
            const tmpl = getTemplateByType(type);
            const label = tmpl?.label ?? type;
            const existingIds = nodes.map((n) => n.id);
            const id = generateNodeIdFromLabel(label, existingIds);
            const nodeData = { label, ...(tmpl?.data ?? {}) };
            const derivedType = deriveNodeType(nodeData, type);
            setNodes((nds) =>
              nds.concat({ id, type: derivedType, position, data: nodeData } as any)
            );
          }}
          onInit={(instance) => setRfInstance(instance)}
          fitView
        >
          <MiniMap />
          <Controls />
          <Background />
        </ReactFlow>
      </div>
      <div
        className="flex flex-col overflow-hidden"
        style={{ height: `calc(100vh - ${showJson ? jsonEditorHeight : 0}px)` }}
      >
        <InspectorPanel
          nodes={nodes as any}
          availableNodeIds={nodes.map((n) => n.id)}
          onChange={(next) => {
            if (!selectedNodeId || selectedNodeId !== next.id) return;

            // Get current node to compare functions before update
            const currentNode = nodes.find((n) => n.id === selectedNodeId);
            const oldFunctions = ((currentNode?.data as any)?.functions as any[] | undefined) ?? [];

            // Update node data (updateNodeData handles function index adjustment)
            updateNodeData(next.id, next.data, oldFunctions);
          }}
          onDelete={(id, kind) => {
            if (kind === "edge") {
              // Edge deletion: remove the function's next_node_id
              const edge = edges.find((e) => e.id === id);
              if (!edge) return;

              const sourceNode = nodes.find((n) => n.id === edge.source);
              if (!sourceNode) return;

              const functions = ((sourceNode.data as any)?.functions as any[] | undefined) ?? [];
              const functionIndex = functions.findIndex(
                (f) => f.next_node_id === edge.target && f.name === (edge.label as string)
              );

              if (functionIndex >= 0) {
                // Remove next_node_id from the function (this removes the edge)
                const updatedFunctions = [...functions];
                updatedFunctions[functionIndex] = {
                  ...updatedFunctions[functionIndex],
                  next_node_id: undefined,
                };

                // Update node (preserves selectedNodeId to keep inspector open)
                updateNodeData(edge.source, { functions: updatedFunctions }, functions);

                // Clear function highlight if this was the selected function
                if (selectedNodeId === edge.source && selectedFunctionIndex === functionIndex) {
                  useEditorStore.getState().clearFunctionSelection();
                }
              }
            } else {
              // Node deletion: remove node and clear selection
              setNodes((nds) => nds.filter((n) => n.id !== id));
              clearSelection();
            }
          }}
          onRenameNode={(oldId, newId) => {
            // Update the node ID
            setNodes((nds) => nds.map((n) => (n.id === oldId ? { ...n, id: newId } : n)));

            // Update all edges that reference this node
            setEdges((eds) =>
              eds.map((e) => ({
                ...e,
                source: e.source === oldId ? newId : e.source,
                target: e.target === oldId ? newId : e.target,
              }))
            );

            // Update all function next_node_id references across all nodes
            setNodes((nds) =>
              nds.map((node) => {
                const nodeData = node.data as any;
                const functions = (nodeData?.functions || []) as any[];
                const updatedFunctions = functions.map((func: any) => {
                  if (func.next_node_id === oldId) {
                    return { ...func, next_node_id: newId };
                  }
                  return func;
                });

                if (updatedFunctions.some((f, i) => f !== functions[i])) {
                  return {
                    ...node,
                    data: {
                      ...nodeData,
                      functions: updatedFunctions,
                    },
                  };
                }
                return node;
              })
            );

            // Update selected ID if this node was selected
            if (selectedNodeId === oldId) {
              selectNode(newId, selectedFunctionIndex);
            }
          }}
        />
      </div>
      {showJson && (
        <div
          className="absolute bottom-0 left-0 right-0 z-10 border-t bg-white dark:bg-neutral-900"
          style={{ height: `${jsonEditorHeight}px` }}
        >
          <div className="relative h-full flex flex-col">
            <div
              className="absolute top-0 left-0 right-0 h-1 cursor-ns-resize hover:bg-blue-500 bg-transparent z-20"
              onMouseDown={(e) => {
                e.preventDefault();
                const startY = e.clientY;
                const startHeight = jsonEditorHeight;

                const handleMouseMove = (moveEvent: MouseEvent) => {
                  const delta = startY - moveEvent.clientY; // Inverted because we're dragging up
                  const newHeight = Math.max(200, Math.min(800, startHeight + delta));
                  setJsonEditorHeight(newHeight);
                };

                const handleMouseUp = () => {
                  document.removeEventListener("mousemove", handleMouseMove);
                  document.removeEventListener("mouseup", handleMouseUp);
                };

                document.addEventListener("mousemove", handleMouseMove);
                document.addEventListener("mouseup", handleMouseUp);
              }}
            />
            <JsonEditor nodes={nodes as any} edges={edges as any} />
          </div>
        </div>
      )}
      <Button
        variant="secondary"
        size="sm"
        className="absolute z-20"
        style={{ bottom: showJson ? `${jsonEditorHeight + 16}px` : "16px", right: "288px" }}
        onClick={() => setShowJson(!showJson)}
      >
        {showJson ? "Hide Code" : "Show Code"}
      </Button>
      <ToastContainer />
    </div>
  );
}
