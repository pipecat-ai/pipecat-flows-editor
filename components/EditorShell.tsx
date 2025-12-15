"use client";

import "@xyflow/react/dist/style.css";

import {
  Background,
  ColorMode,
  Controls,
  type Edge,
  type NodeChange,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import SelfLoopEdge from "@/components/edges/SelfLoopEdge";
import Toolbar from "@/components/header/Toolbar";
import InspectorPanel from "@/components/inspector/InspectorPanel";
import CodePanel from "@/components/json/CodePanel";
import BaseNode from "@/components/nodes/BaseNode";
import DecisionNode from "@/components/nodes/DecisionNode";
import NodeContextMenu from "@/components/nodes/NodeContextMenu";
import NodePalette from "@/components/palette/NodePalette";
import ToastContainer from "@/components/ui/Toast";
import { extractDecisionNodeFromChange, useDecisionNodes } from "@/hooks/useDecisionNodes";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { getTemplateByType } from "@/lib/nodes/templates";
import type { FlowFunctionJson } from "@/lib/schema/flow.schema";
import { loadCurrent, saveCurrent } from "@/lib/storage/localStore";
import { useEditorStore } from "@/lib/store/editorStore";
import type { FlowEdge, FlowNode, FlowNodeData, ReactFlowInstance } from "@/lib/types/flowTypes";
import { UndoManager } from "@/lib/undo/undoManager";
import {
  handleDecisionNodeConnection,
  handleRegularConnection,
} from "@/lib/utils/connectionHandlers";
import { deriveEdgesFromNodes, edgesChanged } from "@/lib/utils/edgeDerivation";
import { canDeleteNode, deleteNode } from "@/lib/utils/nodeDeletion";
import { duplicateNode } from "@/lib/utils/nodeDuplication";
import { generateNodeIdFromLabel } from "@/lib/utils/nodeId";
import { deriveNodeType } from "@/lib/utils/nodeType";
import {
  clearFunctionConnection,
  updateFunctionReferences,
  updateNodeData,
} from "@/lib/utils/nodeUpdates";

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
      ] as FlowNode[],
      edges: [] as Edge[],
    };
  }, []);
}

export default function EditorShell() {
  const initial = useInitialGraph();
  const [nodes, setNodes, onNodesChangeBase] = useNodesState(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initial.edges);

  // Context menu state
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(
    null
  );
  const [contextMenuNodeId, setContextMenuNodeId] = useState<string | null>(null);

  // Wrap onNodesChange to capture decision node position changes
  const onNodesChange = useCallback(
    (changes: NodeChange<FlowNode>[]) => {
      onNodesChangeBase(changes);

      const positionChanges = changes.filter(
        (change) => change.type === "position" && change.dragging === false && change.position
      );

      if (positionChanges.length > 0) {
        setNodes((currentNodes) => {
          let needsUpdate = false;
          const updatedNodes = currentNodes.map((n) => ({ ...n }));

          positionChanges.forEach((change) => {
            if (change.type !== "position" || !change.id || !change.position) return;
            const decisionInfo = extractDecisionNodeFromChange(
              { id: change.id, position: change.position },
              currentNodes
            );
            if (!decisionInfo) return;

            const sourceNodeIndex = updatedNodes.findIndex(
              (n) => n.id === decisionInfo.sourceNodeId
            );
            if (sourceNodeIndex < 0) return;

            const sourceNode = updatedNodes[sourceNodeIndex];
            const functions = (sourceNode.data?.functions ?? []) as FlowFunctionJson[];
            const functionIndex = functions.findIndex(
              (f) => f.name === decisionInfo.functionName && f.decision !== undefined
            );

            if (functionIndex >= 0 && functions[functionIndex].decision) {
              const updatedFunctions = [...functions];
              updatedFunctions[functionIndex] = {
                ...updatedFunctions[functionIndex],
                decision: {
                  ...updatedFunctions[functionIndex].decision!,
                  decision_node_position: decisionInfo.position,
                },
              };

              updatedNodes[sourceNodeIndex] = {
                ...sourceNode,
                data: {
                  ...sourceNode.data,
                  functions: updatedFunctions,
                },
              };
              needsUpdate = true;
            }
          });

          return needsUpdate ? updatedNodes : currentNodes;
        });
      }
    },
    [onNodesChangeBase, setNodes]
  );

  // Use Zustand store for UI state with proper selectors
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);
  const selectedFunctionIndex = useEditorStore((state) => state.selectedFunctionIndex);
  const showJson = useEditorStore((state) => state.showJson);
  const jsonEditorHeight = useEditorStore((state) => state.jsonEditorHeight);
  const rfInstance = useEditorStore((state) => state.rfInstance);
  const setRfInstance = useEditorStore((state) => state.setRfInstance);
  const selectNode = useEditorStore((state) => state.selectNode);
  const selectNodeFromCanvas = useEditorStore((state) => state.selectNodeFromCanvas);
  const validateFunctionIndexAfterUpdate = useEditorStore(
    (state) => state.validateFunctionIndexAfterUpdate
  );
  const clearSelection = useEditorStore((state) => state.clearSelection);
  const showNodesPanel = useEditorStore((state) => state.showNodesPanel);
  const inspectorPanelWidth = useEditorStore((state) => state.inspectorPanelWidth);
  const isInspectorResizing = useEditorStore((state) => state.isInspectorResizing);

  const undoManagerRef = useRef(new UndoManager({ nodes: initial.nodes, edges: initial.edges }));
  const skipUndoPushRef = useRef(false);

  // Memoize nodeTypes to avoid recreating on every render
  const nodeTypes = useMemo(
    () => ({
      initial: BaseNode,
      node: BaseNode,
      end: BaseNode,
      decision: DecisionNode,
    }),
    []
  );

  // Memoize edgeTypes for custom edge rendering
  const edgeTypes = useMemo(
    () => ({
      selfloop: SelfLoopEdge,
    }),
    []
  );

  // Helper: Update node data and validate function index
  const handleNodeDataUpdate = useCallback(
    (nodeId: string, updates: Partial<FlowNodeData>, previousFunctions?: FlowFunctionJson[]) => {
      const newFunctions = updates.functions;

      setNodes((nds) => updateNodeData(nds, nodeId, updates));

      if (previousFunctions !== undefined && newFunctions !== undefined) {
        validateFunctionIndexAfterUpdate(nodeId, previousFunctions, newFunctions);
      }
    },
    [setNodes, validateFunctionIndexAfterUpdate]
  );

  // load current on mount if present
  useEffect(() => {
    const saved = loadCurrent<{ nodes: FlowNode[]; edges: FlowEdge[] }>();
    if (saved?.nodes && saved?.edges) {
      setNodes(saved.nodes);
      setEdges(saved.edges);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Manage decision nodes lifecycle
  useDecisionNodes(nodes, setNodes);

  // Derive edges from functions whenever nodes change
  useEffect(() => {
    const derivedEdges = deriveEdgesFromNodes(nodes as FlowNode[]);
    setEdges((currentEdges: Edge[]) => {
      const { newEdges } = edgesChanged(currentEdges, derivedEdges);
      return newEdges;
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
        rfInstance.setNodes((nds) =>
          nds.map((node) => ({
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
      undoManagerRef.current.push({ nodes, edges });
    }, 200);
    return () => clearTimeout(id);
  }, [nodes, edges]);

  // Keyboard shortcuts (excluding undo/redo which is handled by Toolbar)
  useKeyboardShortcuts({
    nodes,
    edges,
    selectedNodeId,
    selectedFunctionIndex,
    setNodes,
    clearSelection,
    selectNode,
  });

  // Handle node context menu
  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: FlowNode) => {
      event.preventDefault();

      // Don't show context menu for decision nodes
      if (node.type === "decision") {
        return;
      }

      const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
      const position = rfInstance?.screenToFlowPosition
        ? rfInstance.screenToFlowPosition({
            x: event.clientX - bounds.left,
            y: event.clientY - bounds.top,
          })
        : { x: event.clientX, y: event.clientY };

      setContextMenuPosition({ x: event.clientX, y: event.clientY });
      setContextMenuNodeId(node.id);
      setContextMenuOpen(true);
    },
    [rfInstance]
  );

  // Handle duplicate action
  const handleDuplicateNode = useCallback(() => {
    if (!contextMenuNodeId) return;

    const nodeToDuplicate = nodes.find((n) => n.id === contextMenuNodeId);
    if (!nodeToDuplicate || nodeToDuplicate.type === "decision") return;

    const duplicatedNode = duplicateNode(nodeToDuplicate, nodes);
    setNodes((nds) => nds.concat(duplicatedNode));
    selectNode(duplicatedNode.id);
    setContextMenuOpen(false);
  }, [contextMenuNodeId, nodes, setNodes, selectNode]);

  // Handle delete action
  const handleDeleteNode = useCallback(() => {
    if (!contextMenuNodeId) return;

    const nodeToDelete = nodes.find((n) => n.id === contextMenuNodeId);
    if (!canDeleteNode(nodeToDelete)) return;

    setNodes((nds) => deleteNode(nds, contextMenuNodeId));
    if (selectedNodeId === contextMenuNodeId) {
      clearSelection();
    }
    setContextMenuOpen(false);
  }, [contextMenuNodeId, nodes, setNodes, selectedNodeId, clearSelection]);

  const { theme } = useTheme();

  return (
    <div className="h-screen w-screen flex overflow-hidden">
      <div
        className={`flex flex-col overflow-hidden transition-all duration-300 ease-in-out ${
          showNodesPanel ? "w-56" : "w-0"
        }`}
        style={{ height: `calc(100vh - ${showJson ? jsonEditorHeight : 0}px)` }}
      >
        <div
          className={`w-56 shrink-0 h-full transition-transform duration-300 ease-in-out ${
            showNodesPanel ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <NodePalette nodes={nodes} />
        </div>
      </div>
      <Toolbar
        nodes={nodes}
        edges={edges}
        setNodes={setNodes}
        setEdges={setEdges}
        canUndo={undoManagerRef.current.canUndo()}
        canRedo={undoManagerRef.current.canRedo()}
        onUndo={() => {
          const state = undoManagerRef.current.undo();
          if (state) {
            skipUndoPushRef.current = true;
            setNodes(state.nodes);
            setEdges(state.edges);
          }
        }}
        onRedo={() => {
          const state = undoManagerRef.current.redo();
          if (state) {
            skipUndoPushRef.current = true;
            setNodes(state.nodes);
            setEdges(state.edges);
          }
        }}
        onNewFlow={() => {
          // Reset to initial graph
          skipUndoPushRef.current = true;
          setNodes(initial.nodes);
          setEdges(initial.edges);
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
        className="flex-1 min-w-0 relative overflow-hidden"
        style={{ height: `calc(100vh - ${showJson ? jsonEditorHeight : 0}px)` }}
      >
        <ReactFlow
          colorMode={theme as ColorMode}
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={(params) => {
            if (!params.source || !params.target) return;

            // Try decision node connection first, fallback to regular connection
            const handled = handleDecisionNodeConnection(
              params,
              nodes,
              setNodes,
              (nodeId, functionIndex, conditionIndex) => {
                selectNode(nodeId, functionIndex, conditionIndex);
                // Update React Flow visual selection
                setTimeout(() => {
                  if (rfInstance) {
                    rfInstance.setNodes((nds) =>
                      nds.map((node) => ({
                        ...node,
                        selected: node.id === nodeId,
                      }))
                    );
                  }
                }, 0);
              }
            );

            if (!handled) {
              handleRegularConnection(
                params,
                nodes as FlowNode[],
                setNodes as (updater: (nodes: FlowNode[]) => FlowNode[]) => void,
                (nodeId, functionIndex) => {
                  selectNode(nodeId, functionIndex);
                  setTimeout(() => {
                    if (rfInstance) {
                      rfInstance.setNodes((nds) =>
                        nds.map((node) => ({
                          ...node,
                          selected: node.id === nodeId,
                        }))
                      );
                    }
                  }, 0);
                }
              );
            }
          }}
          onSelectionChange={(sel) => {
            const n = (sel.nodes?.[0] || null) as FlowNode | null;
            const e = (sel.edges?.[0] || null) as FlowEdge | null;
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
            const position = rfInstance?.screenToFlowPosition
              ? rfInstance.screenToFlowPosition({
                  x: e.clientX - bounds.left,
                  y: e.clientY - bounds.top,
                })
              : { x: e.clientX - bounds.left, y: e.clientY - bounds.top };
            const tmpl = getTemplateByType(type);
            const label = tmpl?.label ?? type;
            const existingIds = nodes.map((n) => n.id);
            const id = generateNodeIdFromLabel(label, existingIds);
            const nodeData = { label, ...(tmpl?.data ?? {}) };
            const derivedType = deriveNodeType(nodeData, type);
            setNodes((nds) =>
              nds.concat({
                id,
                type: derivedType as FlowNode["type"],
                position,
                data: nodeData,
              } as FlowNode)
            );
          }}
          onInit={(instance) => setRfInstance(instance as unknown as ReactFlowInstance)}
          onNodeContextMenu={handleNodeContextMenu}
          fitView
        >
          <Controls />
          <Background />
        </ReactFlow>
        <NodeContextMenu
          open={contextMenuOpen}
          onOpenChange={setContextMenuOpen}
          position={contextMenuPosition}
          onDuplicate={handleDuplicateNode}
          onDelete={handleDeleteNode}
          isDecisionNode={
            contextMenuNodeId
              ? nodes.find((n) => n.id === contextMenuNodeId)?.type === "decision"
              : false
          }
        />
      </div>
      <div
        className={`flex flex-col overflow-hidden ${
          isInspectorResizing ? "" : "transition-all duration-300 ease-in-out"
        } ${selectedNodeId ? "" : "w-0"}`}
        style={{
          height: `calc(100vh - ${showJson ? jsonEditorHeight : 0}px)`,
          width: selectedNodeId ? `${inspectorPanelWidth}px` : "0px",
          maxWidth: selectedNodeId ? "min(100vw, 800px)" : "0px",
        }}
      >
        {selectedNodeId && (
          <div
            className="shrink-0 h-full"
            style={{ width: `${inspectorPanelWidth}px`, maxWidth: "min(100vw, 800px)" }}
          >
            <InspectorPanel
              nodes={nodes}
              availableNodeIds={nodes.map((n) => n.id)}
              onChange={(next) => {
                if (!selectedNodeId || selectedNodeId !== next.id) return;

                const currentNode = nodes.find((n) => n.id === selectedNodeId);
                const oldFunctions = (currentNode?.data?.functions ?? []) as FlowFunctionJson[];

                handleNodeDataUpdate(next.id, next.data, oldFunctions);
              }}
              onDelete={(id, kind) => {
                if (kind === "edge") {
                  const edge = edges.find((e) => e.id === id);
                  if (!edge) return;

                  const sourceNode = nodes.find((n) => n.id === edge.source);
                  if (!sourceNode) return;

                  const functions = (sourceNode.data?.functions ?? []) as FlowFunctionJson[];
                  const functionIndex = functions.findIndex(
                    (f) => f.next_node_id === edge.target && f.name === (edge.label as string)
                  );

                  if (functionIndex >= 0) {
                    const previousFunctions = functions;
                    setNodes((nds) => {
                      const updatedNodes = clearFunctionConnection(nds, edge.source, functionIndex);
                      // Validate function index after update
                      const updatedNode = updatedNodes.find((n) => n.id === edge.source);
                      const newFunctions = (updatedNode?.data?.functions ??
                        []) as FlowFunctionJson[];
                      validateFunctionIndexAfterUpdate(
                        edge.source,
                        previousFunctions,
                        newFunctions
                      );
                      return updatedNodes;
                    });

                    if (selectedNodeId === edge.source && selectedFunctionIndex === functionIndex) {
                      useEditorStore.getState().clearFunctionSelection();
                    }
                  }
                } else {
                  const nodeToDelete = nodes.find((n) => n.id === id);
                  if (canDeleteNode(nodeToDelete)) {
                    setNodes((nds) => deleteNode(nds, id));
                    clearSelection();
                  }
                }
              }}
              onRenameNode={(oldId, newId) => {
                // Update node ID
                setNodes((nds) => nds.map((n) => (n.id === oldId ? { ...n, id: newId } : n)));

                // Update edge references
                setEdges((eds) =>
                  eds.map((e) => ({
                    ...e,
                    source: e.source === oldId ? newId : e.source,
                    target: e.target === oldId ? newId : e.target,
                  }))
                );

                // Update function references (including decision conditions)
                setNodes((nds) => updateFunctionReferences(nds, oldId, newId));

                // Update selected ID if this node was selected
                if (selectedNodeId === oldId) {
                  selectNode(newId, selectedFunctionIndex);
                }
              }}
            />
          </div>
        )}
      </div>
      <CodePanel nodes={nodes} edges={edges} />
      <ToastContainer />
    </div>
  );
}
