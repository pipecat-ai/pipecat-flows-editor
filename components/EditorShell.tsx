"use client";

import "@xyflow/react/dist/style.css";

import {
  Background,
  ColorMode,
  Controls,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import SelfLoopEdge from "@/components/edges/SelfLoopEdge";
import Toolbar from "@/components/header/Toolbar";
import InspectorPanel from "@/components/inspector/InspectorPanel";
import BaseNode from "@/components/nodes/BaseNode";
import DecisionNode from "@/components/nodes/DecisionNode";
import NodeContextMenu from "@/components/nodes/NodeContextMenu";
import NodePalette from "@/components/palette/NodePalette";
import ToastContainer, { showToast } from "@/components/ui/Toast";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { deriveCanvasGraph, reconcileEdges } from "@/lib/convert/canvasGraph";
import { configToCanvas, nodeFunctions } from "@/lib/convert/configToCanvas";
import { parseFlowYaml } from "@/lib/document/flowDocument";
import { serializeFlow } from "@/lib/document/serializeFlow";
import { getTemplateByType } from "@/lib/nodes/templates";
import { loadCurrentFlow, saveCurrentFlow } from "@/lib/storage/localStore";
import { loadPositions, positionsFromNodes, savePositions } from "@/lib/storage/positionStore";
import { useEditorStore } from "@/lib/store/editorStore";
import { useFlowStore } from "@/lib/store/flowStore";
import type { FlowEdge, FlowNode, ReactFlowInstance } from "@/lib/types/flowTypes";
import { UndoManager } from "@/lib/undo/undoManager";
import { handleBranchConnection, handleRegularConnection } from "@/lib/utils/connectionHandlers";
import { canDeleteNode, deleteNode } from "@/lib/utils/nodeDeletion";
import { canDuplicateNode, duplicateNode } from "@/lib/utils/nodeDuplication";
import { generateNodeIdFromLabel } from "@/lib/utils/nodeId";
import { deriveNodeType } from "@/lib/utils/nodeType";
import {
  removeEdgeRoute,
  renameFunctionTargets,
  renameNode,
  updateNodeData,
} from "@/lib/utils/nodeUpdates";
import { formatFlowConfigError } from "@/lib/validation/flowConfigValidator";

type History = { nodes: FlowNode[]; edges: FlowEdge[] };

/** The canvas for a new flow: one initial node from its template. */
function newFlowNodes(): FlowNode[] {
  const template = getTemplateByType("initial")!;
  return [
    {
      id: "initial",
      type: "initial",
      position: { x: 100, y: 100 },
      data: { ...template.node, name: "initial", label: "initial", type: "initial" },
    },
  ];
}

export default function EditorShell() {
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>([]);

  // Context menu state
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(
    null
  );
  const [contextMenuNodeId, setContextMenuNodeId] = useState<string | null>(null);

  // Use Zustand store for UI state with proper selectors
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);
  const selectedFunctionIndex = useEditorStore((state) => state.selectedFunctionIndex);
  const rfInstance = useEditorStore((state) => state.rfInstance);
  const setRfInstance = useEditorStore((state) => state.setRfInstance);
  const selectNode = useEditorStore((state) => state.selectNode);
  const selectNodeFromCanvas = useEditorStore((state) => state.selectNodeFromCanvas);
  const validateFunctionIndexAfterUpdate = useEditorStore(
    (state) => state.validateFunctionIndexAfterUpdate
  );
  const clearSelection = useEditorStore((state) => state.clearSelection);
  const showNodesPanel = useEditorStore((state) => state.showNodesPanel);
  const showFlowPanel = useEditorStore((state) => state.showFlowPanel);
  const inspectorPanelWidth = useEditorStore((state) => state.inspectorPanelWidth);
  const isInspectorResizing = useEditorStore((state) => state.isInspectorResizing);
  const loadFlow = useFlowStore((state) => state.loadFlow);
  const resetFlow = useFlowStore((state) => state.reset);

  const undoManagerRef = useRef(new UndoManager<History>({ nodes: [], edges: [] }));
  const skipUndoPushRef = useRef(false);
  // Autosave waits until the saved flow (or a new one) is on the canvas.
  const hydratedRef = useRef(false);

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

  const fitViewSoon = useCallback(() => {
    setTimeout(() => {
      useEditorStore.getState().rfInstance?.fitView?.({ padding: 0.2, duration: 300 });
    }, 100);
  }, []);

  const replaceCanvas = useCallback(
    (next: History) => {
      skipUndoPushRef.current = true;
      setNodes(next.nodes);
      setEdges(next.edges);
      undoManagerRef.current = new UndoManager<History>(next);
      clearSelection();
    },
    [setNodes, setEdges, clearSelection]
  );

  /**
   * Opens YAML text as the current flow. YAML and schema errors refuse the
   * file; reference errors open it and are shown on the canvas.
   */
  const openFlow = useCallback(
    (text: string, flowName: string, options: { silent?: boolean } = {}): boolean => {
      const parsed = parseFlowYaml(text);
      if (parsed.yamlErrors.length > 0) {
        showToast(`Could not parse YAML: ${parsed.yamlErrors[0]}`, "error");
        return false;
      }
      if (!parsed.config) {
        showToast(
          `Not a valid flow config: ${formatFlowConfigError(parsed.schemaErrors[0])}`,
          "error"
        );
        console.error("Schema errors:", parsed.schemaErrors);
        return false;
      }
      const canvas = configToCanvas(parsed.config, { positions: loadPositions(flowName) });
      replaceCanvas(canvas);
      loadFlow({
        flowName,
        document: parsed.document,
        globalFunctions: parsed.config.global_functions ?? [],
      });
      if (parsed.referenceErrors.length > 0) {
        showToast(
          `Opened ${flowName} with ${parsed.referenceErrors.length} unresolved reference${
            parsed.referenceErrors.length === 1 ? "" : "s"
          }: ${formatFlowConfigError(parsed.referenceErrors[0])}`,
          "info"
        );
        console.warn("Reference errors:", parsed.referenceErrors);
      } else if (!options.silent) {
        showToast(`Opened ${flowName}`, "success");
      }
      fitViewSoon();
      return true;
    },
    [replaceCanvas, loadFlow, fitViewSoon]
  );

  const startNewFlow = useCallback(() => {
    replaceCanvas({ nodes: newFlowNodes(), edges: [] });
    resetFlow();
    fitViewSoon();
  }, [replaceCanvas, resetFlow, fitViewSoon]);

  // Restore the autosaved flow on mount, or start a new one
  useEffect(() => {
    const saved = loadCurrentFlow();
    if (!saved || !openFlow(saved.yaml, saved.flowName, { silent: true })) {
      startNewFlow();
    }
    hydratedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Branch nodes and edges are derived from the nodes' function entries
  useEffect(() => {
    const derived = deriveCanvasGraph(nodes);
    if (derived.nodesChanged) setNodes(derived.nodes);
    setEdges((current) => reconcileEdges(current, derived.edges).edges);
  }, [nodes, setNodes, setEdges]);

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

  // Autosave (debounced): the flow as YAML, and the canvas positions beside it
  useEffect(() => {
    if (!hydratedRef.current) return;
    const id = setTimeout(() => {
      const { flowName, document, globalFunctions } = useFlowStore.getState();
      const { text } = serializeFlow(nodes, { document, globalFunctions });
      saveCurrentFlow({ flowName, yaml: text });
      savePositions(flowName, positionsFromNodes(nodes));
    }, 400);
    return () => clearTimeout(id);
  }, [nodes]);

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
  const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: FlowNode) => {
    event.preventDefault();

    // Branch nodes have no menu; they are derived from a function's branch table
    if (node.type === "decision") {
      return;
    }

    setContextMenuPosition({ x: event.clientX, y: event.clientY });
    setContextMenuNodeId(node.id);
    setContextMenuOpen(true);
  }, []);

  // Handle duplicate action
  const handleDuplicateNode = useCallback(() => {
    if (!contextMenuNodeId) return;

    const nodeToDuplicate = nodes.find((n) => n.id === contextMenuNodeId);
    if (!canDuplicateNode(nodeToDuplicate)) return;

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
  const showInspector = Boolean(selectedNodeId) || showFlowPanel;

  return (
    <div className="h-screen w-screen flex overflow-hidden">
      <div
        className={`flex flex-col overflow-hidden transition-all duration-300 ease-in-out h-screen ${
          showNodesPanel ? "w-56" : "w-0"
        }`}
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
        onOpenFlow={openFlow}
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
        onNewFlow={startNewFlow}
      />
      <div className="flex-1 min-w-0 relative overflow-hidden h-screen">
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

            const focusNode = (nodeId: string) => {
              setTimeout(() => {
                rfInstance?.setNodes((nds) =>
                  nds.map((node) => ({ ...node, selected: node.id === nodeId }))
                );
              }, 0);
            };

            // Out of a branch node: a new case. Out of a node: a new function.
            const handled = handleBranchConnection(
              params,
              nodes,
              setNodes,
              (nodeId, functionIndex, caseIndex) => {
                selectNode(nodeId, functionIndex, caseIndex);
                focusNode(nodeId);
              }
            );

            if (!handled) {
              handleRegularConnection(params, nodes, setNodes, (nodeId, functionIndex) => {
                selectNode(nodeId, functionIndex);
                focusNode(nodeId);
              });
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
            const template = getTemplateByType(type);
            if (!template) return;

            // The config has one entry point
            if (template.type === "initial" && nodes.some((n) => n.type === "initial")) {
              return;
            }

            const bounds = (e.target as HTMLElement).getBoundingClientRect();
            const position = rfInstance?.screenToFlowPosition
              ? rfInstance.screenToFlowPosition({
                  x: e.clientX - bounds.left,
                  y: e.clientY - bounds.top,
                })
              : { x: e.clientX - bounds.left, y: e.clientY - bounds.top };
            const id = generateNodeIdFromLabel(
              template.label,
              nodes.map((n) => n.id)
            );
            const nodeType = deriveNodeType(template.node, template.type);
            setNodes((nds) =>
              nds.concat({
                id,
                type: nodeType,
                position,
                data: { ...template.node, name: id, label: id, type: nodeType },
              })
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
        className={`flex flex-col overflow-hidden h-screen ${
          isInspectorResizing ? "" : "transition-all duration-300 ease-in-out"
        } ${showInspector ? "" : "w-0"}`}
        style={{
          width: showInspector ? `${inspectorPanelWidth}px` : "0px",
          maxWidth: showInspector ? "min(100vw, 800px)" : "0px",
        }}
      >
        {showInspector && (
          <div
            className="shrink-0 h-full"
            style={{ width: `${inspectorPanelWidth}px`, maxWidth: "min(100vw, 800px)" }}
          >
            <InspectorPanel
              nodes={nodes}
              availableNodeIds={nodes.filter((n) => n.type !== "decision").map((n) => n.id)}
              onChange={(next) => {
                if (!selectedNodeId || selectedNodeId !== next.id) return;

                const previousFunctions = nodeFunctions(nodes.find((n) => n.id === selectedNodeId));
                setNodes((nds) => updateNodeData(nds, next.id, next.data));
                if (next.data.functions !== undefined) {
                  validateFunctionIndexAfterUpdate(next.id, previousFunctions, next.data.functions);
                }
              }}
              onDelete={(id, kind) => {
                if (kind === "edge") {
                  const edge = edges.find((e) => e.id === id);
                  if (!edge?.data) return;
                  setNodes((nds) => removeEdgeRoute(nds, edge));
                  const functionIndex = nodeFunctions(
                    nodes.find((n) => n.id === edge.data?.sourceNodeId)
                  ).findIndex((fn) => fn.name === edge.data?.functionName);
                  if (
                    selectedNodeId === edge.data.sourceNodeId &&
                    selectedFunctionIndex === functionIndex
                  ) {
                    useEditorStore.getState().clearFunctionSelection();
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
                setNodes((nds) => renameNode(nds, oldId, newId));
                const flow = useFlowStore.getState();
                flow.setGlobalFunctions(renameFunctionTargets(flow.globalFunctions, oldId, newId));
                if (selectedNodeId === oldId) {
                  selectNode(newId, selectedFunctionIndex);
                }
              }}
            />
          </div>
        )}
      </div>
      <ToastContainer />
    </div>
  );
}
