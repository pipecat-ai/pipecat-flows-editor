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
  const setShowJson = useEditorStore((state) => state.setShowJson);
  const setJsonEditorHeight = useEditorStore((state) => state.setJsonEditorHeight);

  const handleResizeStart = (e: React.MouseEvent) => {
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
  };

  return (
    <>
      {showJson && (
        <div
          className="absolute bottom-0 left-0 right-0 z-10 border-t bg-white dark:bg-neutral-900"
          style={{ height: `${jsonEditorHeight}px` }}
        >
          <div className="relative h-full flex flex-col">
            <div
              className="absolute top-0 left-0 right-0 h-1 cursor-ns-resize hover:bg-blue-500 bg-transparent z-20"
              onMouseDown={handleResizeStart}
            />
            <CodeViewer nodes={nodes} edges={edges} />
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
    </>
  );
}
