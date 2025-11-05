"use client";

import type { Edge, Node } from "reactflow";

import { Button } from "@/components/ui/button";
import { useEditorStore } from "@/lib/store/editorStore";

import CodeViewer from "./CodeViewer";

interface Props {
  nodes: Node[];
  edges: Edge[];
}

export default function CodePanel({ nodes, edges }: Props) {
  const showJson = useEditorStore((state) => state.showJson);
  const jsonEditorHeight = useEditorStore((state) => state.jsonEditorHeight);
  const inspectorPanelWidth = useEditorStore((state) => state.inspectorPanelWidth);
  const setShowJson = useEditorStore((state) => state.setShowJson);
  const setJsonEditorHeight = useEditorStore((state) => state.setJsonEditorHeight);
  const setIsCodePanelResizing = useEditorStore((state) => state.setIsCodePanelResizing);
  const isCodePanelResizing = useEditorStore((state) => state.isCodePanelResizing);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsCodePanelResizing(true);
    const startY = e.clientY;
    const startHeight = jsonEditorHeight;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = startY - moveEvent.clientY; // Inverted because we're dragging up
      const newHeight = Math.max(200, Math.min(800, startHeight + delta));
      setJsonEditorHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsCodePanelResizing(false);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <>
      <div
        className={`absolute bottom-0 left-0 right-0 z-10 border-t bg-white dark:bg-neutral-900 overflow-hidden pointer-events-none ${
          isCodePanelResizing
            ? ""
            : "transition-transform duration-300 ease-in-out"
        } ${showJson ? "translate-y-0 pointer-events-auto" : "translate-y-full"}`}
        style={{ height: `${jsonEditorHeight}px` }}
      >
        <div className="relative h-full flex flex-col">
          <div
            className="absolute top-0 left-0 right-0 h-1 cursor-ns-resize hover:bg-blue-500 bg-transparent z-20 pointer-events-auto"
            onMouseDown={handleResizeStart}
          />
          <CodeViewer nodes={nodes} edges={edges} />
        </div>
      </div>
      <Button
        variant="secondary"
        size="sm"
        className={`absolute z-20 left-1/2 -translate-x-1/2 ${
          isCodePanelResizing ? "" : "transition-all duration-300"
        }`}
        style={{
          bottom: showJson ? `${jsonEditorHeight + 16}px` : "16px",
        }}
        onClick={() => setShowJson(!showJson)}
      >
        {showJson ? "Hide Code" : "Show Code"}
      </Button>
    </>
  );
}
