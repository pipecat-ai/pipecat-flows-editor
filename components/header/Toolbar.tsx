"use client";

import { reactFlowToFlowJson, flowJsonToReactFlow } from "@/lib/convert/flowAdapters";
import { customGraphChecks, validateFlowJson } from "@/lib/validation/validator";
import { generatePythonCode } from "@/lib/codegen/pythonGenerator";
import { useRef } from "react";
import { EXAMPLES } from "@/lib/examples";
import { showToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileText } from "lucide-react";
import { useEditorStore } from "@/lib/store/editorStore";

type Props = {
  nodes: any[];
  edges: any[];
  setNodes: (fn: any) => void;
  setEdges: (fn: any) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onNewFlow: () => void;
};

export default function Toolbar({
  nodes,
  edges,
  setNodes,
  setEdges,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onNewFlow,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const rfInstance = useEditorStore((state) => state.rfInstance);

  function onExport() {
    const json = reactFlowToFlowJson(nodes as any, edges as any);
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "flow.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function onExportPython() {
    const json = reactFlowToFlowJson(nodes as any, edges as any);
    const r = validateFlowJson(json);
    if (!r.valid) {
      showToast("Flow must be valid before exporting Python code", "error");
      return;
    }
    try {
      const pythonCode = generatePythonCode(json);
      const blob = new Blob([pythonCode], { type: "text/x-python" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${json.meta.name.toLowerCase().replace(/\s+/g, "_")}_flow.py`;
      a.click();
      URL.revokeObjectURL(a.href);
      showToast("Python code exported successfully", "success");
    } catch (error) {
      console.error("Failed to generate Python code:", error);
      showToast("Failed to generate Python code", "error");
    }
  }

  function onImport(file: File, input: HTMLInputElement) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(String(reader.result));
        const r = validateFlowJson(json);
        if (!r.valid) {
          showToast("Invalid JSON schema for flow", "error");
          return;
        }
        const custom = customGraphChecks(json);
        if (custom.length) {
          showToast("Custom validation failed. See console for details.", "error");
          console.error("Custom validation errors:", custom);
          return;
        }
        const rf = flowJsonToReactFlow(json);
        setNodes(rf.nodes);
        setEdges(rf.edges);
        showToast("Flow imported successfully", "success");
        setTimeout(() => {
          rfInstance?.fitView?.({ padding: 0.2, duration: 300 });
        }, 100);
        input.value = "";
      } catch {
        showToast("Failed to import JSON", "error");
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="absolute left-1/2 top-4 z-10 -translate-x-1/2 flex gap-2 rounded-md bg-white/80 p-2 text-sm shadow backdrop-blur dark:bg-black/40">
      <Button variant="secondary" size="sm" onClick={onNewFlow} title="Create a new flow">
        New Flow
      </Button>
      <div className="w-px bg-neutral-300 dark:bg-neutral-700" />
      <Button
        variant="secondary"
        size="sm"
        onClick={onUndo}
        disabled={!canUndo}
        title="Undo (Cmd/Ctrl+Z)"
      >
        Undo
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={onRedo}
        disabled={!canRedo}
        title="Redo (Cmd/Ctrl+Shift+Z)"
      >
        Redo
      </Button>
      <div className="w-px bg-neutral-300 dark:bg-neutral-700" />
      <Input
        ref={inputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(e) => e.target.files && onImport(e.target.files[0], e.target)}
      />
      <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
        Import
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="sm">
            <Download />
            Export…
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={onExport}>Export JSON</DropdownMenuItem>
          <DropdownMenuItem onClick={onExportPython}>Export Python</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="sm">
            <FileText />
            Load Example…
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {EXAMPLES.map((ex) => (
            <DropdownMenuItem
              key={ex.id}
              onClick={() => {
                const rf = flowJsonToReactFlow(ex.json as any);
                setNodes(rf.nodes);
                setEdges(rf.edges);
                // Center the view after a short delay to ensure nodes are rendered
                setTimeout(() => {
                  rfInstance?.fitView?.({ padding: 0.2, duration: 300 });
                }, 100);
              }}
            >
              {ex.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
