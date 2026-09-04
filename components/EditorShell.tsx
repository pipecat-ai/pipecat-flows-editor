"use client";

import "@xyflow/react/dist/style.css";

import {
  Background,
  ColorMode,
  Controls,
  ReactFlow,
  SelectionMode,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import SelfLoopEdge from "@/components/edges/SelfLoopEdge";
import Toolbar from "@/components/header/Toolbar";
import InspectorPanel from "@/components/inspector/InspectorPanel";
import BaseNode from "@/components/nodes/BaseNode";
import { type CanvasActions, CanvasActionsContext } from "@/components/nodes/canvasActions";
import NodeContextMenu from "@/components/nodes/NodeContextMenu";
import ToastContainer, { showToast } from "@/components/ui/Toast";
import YamlPanel from "@/components/yaml/YamlPanel";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { deriveCanvasEdges, reconcileEdges } from "@/lib/convert/canvasGraph";
import { configToCanvas, nodeFunctions } from "@/lib/convert/configToCanvas";
import {
  createFlowDocument,
  DEFAULT_FLOW_NAME,
  type FlowProblem,
  parseFlowYaml,
  stringifyFlowDocument,
} from "@/lib/document/flowDocument";
import {
  convertLegacyFlow,
  describeLegacyDrops,
  isLegacyFlowJson,
} from "@/lib/document/legacyImport";
import { serializeFlow } from "@/lib/document/serializeFlow";
import { layoutNodes } from "@/lib/layout/autoLayout";
import { getTemplateByType } from "@/lib/nodes/templates";
import type { FlowConfig } from "@/lib/schema/flowConfig";
import { LEGACY_STORAGE_KEY, loadCurrentFlow, saveCurrentFlow } from "@/lib/storage/localStore";
import { loadPositions, positionsFromNodes, savePositions } from "@/lib/storage/positionStore";
import { useEditorStore } from "@/lib/store/editorStore";
import { useFlowStore } from "@/lib/store/flowStore";
import type { FlowEdge, FlowNode, ReactFlowInstance } from "@/lib/types/flowTypes";
import { UndoManager } from "@/lib/undo/undoManager";
import { handleConnection } from "@/lib/utils/connectionHandlers";
import { filterNodeChanges } from "@/lib/utils/nodeChanges";
import {
  addBranchCaseDestination,
  addDestination,
  type Added,
  addFunctionDestination,
  setInitialNode,
} from "@/lib/utils/nodeCreation";
import { canDeleteNode, deleteNode } from "@/lib/utils/nodeDeletion";
import { canDuplicateNode, duplicateNode } from "@/lib/utils/nodeDuplication";
import {
  removeEdgeRoute,
  renameFunctionTargets,
  renameNode,
  updateNodeData,
} from "@/lib/utils/nodeUpdates";
import { formatFlowConfigError } from "@/lib/validation/flowConfigValidator";

type History = { nodes: FlowNode[]; edges: FlowEdge[] };

/** Structural equality with key order ignored, for comparing configs from different sources. */
function sameConfig(a: FlowConfig | null, b: FlowConfig | null): boolean {
  return stableStringify(a) === stableStringify(b);
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

/**
 * If `text` is a document in the editor's old JSON format, the same flow as
 * YAML, with its canvas positions stored under `flowName` and an account of
 * what did not convert. Otherwise null.
 */
function convertLegacyText(
  text: string,
  flowName: string
): { yaml: string; dropped: string } | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isLegacyFlowJson(data)) return null;
  const { config, positions, dropped } = convertLegacyFlow(data);
  savePositions(flowName, positions);
  return {
    yaml: stringifyFlowDocument(createFlowDocument(config)),
    dropped: describeLegacyDrops(dropped),
  };
}

/** The old editor's autosave, as text, when present. */
function readLegacyAutosave(): string | null {
  try {
    return localStorage.getItem(LEGACY_STORAGE_KEY);
  } catch {
    return null;
  }
}

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
  const [nodes, setNodes, onNodesChangeBase] = useNodesState<FlowNode>([]);
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
  const showFlowPanel = useEditorStore((state) => state.showFlowPanel);
  const inspectorPanelWidth = useEditorStore((state) => state.inspectorPanelWidth);
  const isInspectorResizing = useEditorStore((state) => state.isInspectorResizing);
  const loadFlow = useFlowStore((state) => state.loadFlow);
  const resetFlow = useFlowStore((state) => state.reset);
  const flowName = useFlowStore((state) => state.flowName);
  const globalFunctions = useFlowStore((state) => state.globalFunctions);
  const showYaml = useEditorStore((state) => state.showYaml);
  const yamlPanelHeight = useEditorStore((state) => state.yamlPanelHeight);

  // The YAML pane. `paneConfigRef` is the config the pane's text last parsed
  // to; the canvas rewrites the pane only when it holds something different,
  // so the author's formatting and cursor survive canvas-side changes that
  // do not touch the config, and echoes of pane edits are ignored.
  const [yamlText, setYamlText] = useState("");
  const [yamlProblems, setYamlProblems] = useState<FlowProblem[]>([]);
  const paneConfigRef = useRef<FlowConfig | null>(null);
  const paneApplyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nodesRef = useRef<FlowNode[]>([]);
  nodesRef.current = nodes;

  // React Flow's own delete handling goes through here; keep the editor's rules
  const onNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChangeBase>[0]) =>
      onNodesChangeBase(filterNodeChanges(changes, nodesRef.current)),
    [onNodesChangeBase]
  );

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
      const legacy = convertLegacyText(text, flowName);
      if (legacy) {
        text = legacy.yaml;
        showToast(
          `Converted ${flowName} from the old JSON format. ${legacy.dropped}`.trim(),
          "info"
        );
      }
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
      // The pane shows the file as written
      paneConfigRef.current = parsed.config;
      setYamlText(text);
      setYamlProblems(parsed.problems);
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

  // Restore the autosaved flow on mount, converting one left by the old
  // editor if that is all there is, or start a new one
  useEffect(() => {
    const saved = loadCurrentFlow();
    const legacy = saved ? null : readLegacyAutosave();
    if (saved) {
      if (!openFlow(saved.yaml, saved.flowName, { silent: true })) startNewFlow();
    } else if (!legacy || !openFlow(legacy, DEFAULT_FLOW_NAME)) {
      startNewFlow();
    }
    hydratedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Edges are derived from the nodes' function entries
  useEffect(() => {
    const derived = deriveCanvasEdges(nodes);
    setEdges((current) => reconcileEdges(current, derived).edges);
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

  // Document sync (debounced): serialize the canvas, autosave it with the
  // canvas positions, and rewrite the YAML pane when the config changed.
  useEffect(() => {
    if (!hydratedRef.current) return;
    const id = setTimeout(() => {
      const { document } = useFlowStore.getState();
      const { text, config } = serializeFlow(nodes, { document, globalFunctions });
      saveCurrentFlow({ flowName, yaml: text });
      savePositions(flowName, positionsFromNodes(nodes));
      if (!sameConfig(config, paneConfigRef.current)) {
        paneConfigRef.current = config;
        setYamlText(text);
        setYamlProblems(parseFlowYaml(text).problems);
      }
    }, 300);
    return () => clearTimeout(id);
  }, [nodes, globalFunctions, flowName]);

  // Pane edits re-parse onto the canvas after a pause in typing. Text that
  // does not parse or match the schema only updates the markers.
  const applyYamlText = useCallback(
    (text: string) => {
      const parsed = parseFlowYaml(text);
      setYamlProblems(parsed.problems);
      if (!parsed.config) return;
      paneConfigRef.current = parsed.config;
      const { flowName: name, setDocument, setGlobalFunctions } = useFlowStore.getState();
      const positions = { ...loadPositions(name), ...positionsFromNodes(nodesRef.current) };
      const canvas = configToCanvas(parsed.config, { positions });
      setNodes(canvas.nodes);
      setEdges(canvas.edges);
      setDocument(parsed.document);
      setGlobalFunctions(parsed.config.global_functions ?? []);
    },
    [setNodes, setEdges]
  );

  const onYamlChange = useCallback(
    (text: string) => {
      setYamlText(text);
      if (paneApplyTimerRef.current) clearTimeout(paneApplyTimerRef.current);
      paneApplyTimerRef.current = setTimeout(() => applyYamlText(text), 400);
    },
    [applyYamlText]
  );

  useEffect(() => {
    return () => {
      if (paneApplyTimerRef.current) clearTimeout(paneApplyTimerRef.current);
    };
  }, []);

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

  // "+" on a node: a new node and the function that leads to it, with the
  // inspector opened on that function so its tool name gets typed.
  const applyAdded = useCallback(
    (added: Added | null) => {
      if (!added) return;
      setNodes(added.nodes);
      selectNode(added.sourceNodeId, added.functionIndex, added.caseIndex ?? null);
      setTimeout(() => {
        rfInstance?.setNodes((nds) =>
          nds.map((node) => ({ ...node, selected: node.id === added.sourceNodeId }))
        );
      }, 0);
    },
    [setNodes, selectNode, rfInstance]
  );

  const focusNode = useCallback(
    (nodeId: string) => {
      setTimeout(() => {
        rfInstance?.setNodes((nds) =>
          nds.map((node) => ({ ...node, selected: node.id === nodeId }))
        );
      }, 0);
    },
    [rfInstance]
  );

  const canvasActions = useMemo<CanvasActions>(
    () => ({
      addDestination: (sourceNodeId, kind) =>
        applyAdded(addDestination(nodesRef.current, sourceNodeId, kind)),
      addFunctionDestination: (sourceNodeId, functionIndex, kind) =>
        applyAdded(addFunctionDestination(nodesRef.current, sourceNodeId, functionIndex, kind)),
      addBranchCase: (sourceNodeId, functionIndex) =>
        applyAdded(addBranchCaseDestination(nodesRef.current, sourceNodeId, functionIndex)),
      selectRow: (sourceNodeId, functionIndex, caseIndex) => {
        selectNode(sourceNodeId, functionIndex, caseIndex);
        focusNode(sourceNodeId);
      },
    }),
    [applyAdded, selectNode, focusNode]
  );

  const handleMakeInitial = useCallback(() => {
    if (!contextMenuNodeId) return;
    setNodes((nds) => setInitialNode(nds, contextMenuNodeId));
    setContextMenuOpen(false);
  }, [contextMenuNodeId, setNodes]);

  const handleAutoLayout = useCallback(() => {
    setNodes((nds) => layoutNodes(nds, edges));
    fitViewSoon();
  }, [setNodes, edges, fitViewSoon]);

  const { theme } = useTheme();
  const showInspector = Boolean(selectedNodeId) || showFlowPanel;
  const columnHeight = `calc(100vh - ${showYaml ? yamlPanelHeight : 0}px)`;

  return (
    <div className="h-screen w-screen flex overflow-hidden">
      <Toolbar
        nodes={nodes}
        onOpenFlow={openFlow}
        onAutoLayout={handleAutoLayout}
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
      <div className="flex-1 min-w-0 relative overflow-hidden" style={{ height: columnHeight }}>
        <CanvasActionsContext.Provider value={canvasActions}>
          <ReactFlow
            colorMode={theme as ColorMode}
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={(params) => {
              const connected = handleConnection(params, nodes, setNodes);
              if (!connected) return;
              selectNode(connected.sourceNodeId, connected.functionIndex, connected.caseIndex);
              focusNode(connected.sourceNodeId);
            }}
            onSelectionChange={(sel) => {
              const n = (sel.nodes?.[0] || null) as FlowNode | null;
              const e = (sel.edges?.[0] || null) as FlowEdge | null;
              // Store handles all selection logic and validation
              selectNodeFromCanvas(n, e, nodes);
            }}
            snapToGrid={true}
            snapGrid={[20, 20]}
            // Left-drag selects; middle or right drag pans, as does Space+drag.
            // Trackpads have no middle button, so scrolling pans and pinch zooms.
            panOnDrag={[1, 2]}
            selectionOnDrag
            selectionMode={SelectionMode.Partial}
            panOnScroll
            zoomOnScroll={false}
            onInit={(instance) => setRfInstance(instance as unknown as ReactFlowInstance)}
            onNodeContextMenu={handleNodeContextMenu}
            fitView
          >
            <Controls />
            <Background />
          </ReactFlow>
        </CanvasActionsContext.Provider>
        <NodeContextMenu
          open={contextMenuOpen}
          onOpenChange={setContextMenuOpen}
          position={contextMenuPosition}
          onDuplicate={handleDuplicateNode}
          onDelete={handleDeleteNode}
          onMakeInitial={handleMakeInitial}
          isInitialNode={
            contextMenuNodeId
              ? nodes.find((n) => n.id === contextMenuNodeId)?.type === "initial"
              : false
          }
        />
      </div>
      <div
        className={`flex flex-col overflow-hidden ${
          isInspectorResizing ? "" : "transition-all duration-300 ease-in-out"
        } ${showInspector ? "" : "w-0"}`}
        style={{
          height: columnHeight,
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
              availableNodeIds={nodes.map((n) => n.id)}
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
      <YamlPanel text={yamlText} problems={yamlProblems} onChange={onYamlChange} />
      <ToastContainer />
    </div>
  );
}
