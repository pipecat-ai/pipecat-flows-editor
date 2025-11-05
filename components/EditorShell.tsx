"use client";

import "reactflow/dist/style.css";

import { extractDecisionNodeFromChange, useDecisionNodes } from "hooks/useDecisionNodes";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Background, Controls, MiniMap, ReactFlow, useEdgesState, useNodesState } from "reactflow";

import Toolbar from "@/components/header/Toolbar";
import InspectorPanel from "@/components/inspector/InspectorPanel";
import CodePanel from "@/components/json/CodePanel";
import BaseNode from "@/components/nodes/BaseNode";
import DecisionNode from "@/components/nodes/DecisionNode";
import NodePalette from "@/components/palette/NodePalette";
import ToastContainer from "@/components/ui/Toast";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { getTemplateByType } from "@/lib/nodes/templates";
import { loadCurrent, saveCurrent } from "@/lib/storage/localStore";
import { useEditorStore } from "@/lib/store/editorStore";
import { UndoManager } from "@/lib/undo/undoManager";
import {
  handleDecisionNodeConnection,
  handleRegularConnection,
} from "@/lib/utils/connectionHandlers";
import { deriveEdgesFromNodes, edgesChanged } from "@/lib/utils/edgeDerivation";
import { generateNodeIdFromLabel } from "@/lib/utils/nodeId";
import { deriveNodeType } from "@/lib/utils/nodeType";
import { updateFunctionReferences, updateNodeData } from "@/lib/utils/nodeUpdates";

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
  const [nodes, setNodes, onNodesChangeBase] = useNodesState(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);

  // Wrap onNodesChange to capture decision node position changes
  const onNodesChange = useCallback(
    (changes: any[]) => {
      onNodesChangeBase(changes);

      const positionChanges = changes.filter(
        (change) => change.type === "position" && change.dragging === false && change.position
      );

      if (positionChanges.length > 0) {
        setNodes((currentNodes) => {
          let needsUpdate = false;
          const updatedNodes = currentNodes.map((n) => ({ ...n }));

          positionChanges.forEach((change) => {
            const decisionInfo = extractDecisionNodeFromChange(change, currentNodes);
            if (!decisionInfo) return;

            const sourceNodeIndex = updatedNodes.findIndex(
              (n) => n.id === decisionInfo.sourceNodeId
            );
            if (sourceNodeIndex < 0) return;

            const sourceNode = updatedNodes[sourceNodeIndex];
            const functions = ((sourceNode.data as any)?.functions as any[] | undefined) ?? [];
            const functionIndex = functions.findIndex(
              (f: any) => f.name === decisionInfo.functionName && f.decision !== undefined
            );

            if (functionIndex >= 0) {
              const updatedFunctions = [...functions];
              updatedFunctions[functionIndex] = {
                ...updatedFunctions[functionIndex],
                decision: {
                  ...updatedFunctions[functionIndex].decision,
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

  const undoManagerRef = useRef(new UndoManager({ nodes: initial.nodes, edges: initial.edges }));
  const skipUndoPushRef = useRef(false);

  // Memoize nodeTypes to avoid recreating on every render
  const nodeTypes = useMemo(
    () => ({
      initial: BaseNode,
      llm_task: BaseNode,
      end: BaseNode,
      decision: DecisionNode,
    }),
    []
  );

  // Helper: Update node data and validate function index
  const handleNodeDataUpdate = useCallback(
    (nodeId: string, updates: Partial<any>, previousFunctions?: any[]) => {
      const newFunctions = updates.functions as any[] | undefined;

      setNodes((nds) => updateNodeData(nds, nodeId, updates));

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

  // Manage decision nodes lifecycle
  useDecisionNodes(nodes, setNodes);

  // Derive edges from functions whenever nodes change
  useEffect(() => {
    const derivedEdges = deriveEdgesFromNodes(nodes);
    setEdges((currentEdges) => {
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
                    rfInstance.setNodes((nds: any[]) =>
                      nds.map((node: any) => ({
                        ...node,
                        selected: node.id === nodeId,
                      }))
                    );
                  }
                }, 0);
              }
            );

            if (!handled) {
              handleRegularConnection(params, nodes, setNodes, (nodeId, functionIndex) => {
                selectNode(nodeId, functionIndex);
                setTimeout(() => {
                  if (rfInstance) {
                    rfInstance.setNodes((nds: any[]) =>
                      nds.map((node: any) => ({
                        ...node,
                        selected: node.id === nodeId,
                      }))
                    );
                  }
                }, 0);
              });
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

            const currentNode = nodes.find((n) => n.id === selectedNodeId);
            const oldFunctions = ((currentNode?.data as any)?.functions as any[] | undefined) ?? [];

            handleNodeDataUpdate(next.id, next.data, oldFunctions);
          }}
          onDelete={(id, kind) => {
            if (kind === "edge") {
              const edge = edges.find((e) => e.id === id);
              if (!edge) return;

              const sourceNode = nodes.find((n) => n.id === edge.source);
              if (!sourceNode) return;

              const functions = ((sourceNode.data as any)?.functions as any[] | undefined) ?? [];
              const functionIndex = functions.findIndex(
                (f) => f.next_node_id === edge.target && f.name === (edge.label as string)
              );

              if (functionIndex >= 0) {
                const updatedFunctions = [...functions];
                updatedFunctions[functionIndex] = {
                  ...updatedFunctions[functionIndex],
                  next_node_id: undefined,
                };

                handleNodeDataUpdate(edge.source, { functions: updatedFunctions }, functions);

                if (selectedNodeId === edge.source && selectedFunctionIndex === functionIndex) {
                  useEditorStore.getState().clearFunctionSelection();
                }
              }
            } else {
              setNodes((nds) => nds.filter((n) => n.id !== id));
              clearSelection();
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
      <CodePanel nodes={nodes as any} edges={edges as any} />
      <ToastContainer />
    </div>
  );
}
