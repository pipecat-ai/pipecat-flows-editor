"use client";

import { IconBook, IconBrandGithub, IconDots, IconHome } from "@tabler/icons-react";
import {
  ChevronRight,
  Download,
  FilePlusCorner,
  FileText,
  MoreHorizontal,
  Redo2,
  Undo2,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useRef } from "react";

import PipecatLogo from "@/components/icons/PipecatLogo";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { showToast } from "@/components/ui/Toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { generatePythonCode } from "@/lib/codegen/pythonGenerator";
import { flowJsonToReactFlow, reactFlowToFlowJson } from "@/lib/convert/flowAdapters";
import { EXAMPLES } from "@/lib/examples";
import { FlowJson } from "@/lib/schema/flow.schema";
import { useEditorStore } from "@/lib/store/editorStore";
import type { FlowEdge, FlowNode } from "@/lib/types/flowTypes";
import { customGraphChecks, validateFlowJson } from "@/lib/validation/validator";

type Props = {
  nodes: FlowNode[];
  edges: FlowEdge[];
  setNodes: (nodes: FlowNode[]) => void;
  setEdges: (edges: FlowEdge[] | ((edges: FlowEdge[]) => FlowEdge[])) => void;
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
  const showNodesPanel = useEditorStore((state) => state.showNodesPanel);
  const setShowNodesPanel = useEditorStore((state) => state.setShowNodesPanel);

  function onExport() {
    const json = reactFlowToFlowJson(nodes, edges);
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "flow.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function onExportPython() {
    const json = reactFlowToFlowJson(nodes, edges);
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
        setNodes(rf.nodes as FlowNode[]);
        setEdges(rf.edges as FlowEdge[]);
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

  const moreLinks = (
    <>
      <DropdownMenuItem asChild>
        <Link href="/">
          <IconHome size={16} />
          Home
        </Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <a
          href="https://github.com/pipecat-ai/pipecat-flows-editor"
          target="_blank"
          rel="noreferrer"
        >
          <IconBrandGithub size={16} />
          Repository
        </a>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <a
          href="https://docs.pipecat.ai/guides/features/pipecat-flows"
          target="_blank"
          rel="noreferrer"
        >
          <IconBook size={16} />
          Pipecat Flows
        </a>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <a href="https://pipecat.ai" target="_blank" rel="noreferrer">
          <PipecatLogo height={16} />
          Pipecat
        </a>
      </DropdownMenuItem>
    </>
  );

  return (
    <TooltipProvider>
      <div
        className={`absolute top-2 md:top-4 left-2 z-10 flex gap-2 rounded-md bg-white/80 p-2 text-sm shadow backdrop-blur dark:bg-black/40 transition-all duration-300 ${
          showNodesPanel ? "left-[232px]" : ""
        }`}
      >
        {!showNodesPanel && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setShowNodesPanel(true)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent align="start">Show nodes panel</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        <Button variant="secondary" size="sm" onClick={onNewFlow} title="Create a new flow">
          <FilePlusCorner className="h-4 w-4" />
          <span className="sr-only lg:not-sr-only">New Flow</span>
        </Button>
        <div className="w-px bg-neutral-300 dark:bg-neutral-700" />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="secondary"
              size="sm"
              onClick={onUndo}
              disabled={!canUndo}
              className="px-2"
            >
              <Undo2 className="h-4 w-4" />
              <span className="sr-only lg:not-sr-only">Undo</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Undo (Cmd/Ctrl+Z)</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="secondary"
              size="sm"
              onClick={onRedo}
              disabled={!canRedo}
              className="px-2"
            >
              <Redo2 className="h-4 w-4" />
              <span className="sr-only lg:not-sr-only">Redo</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Redo (Cmd/Ctrl+Shift+Z)</p>
          </TooltipContent>
        </Tooltip>
        <div className="w-px bg-neutral-300 dark:bg-neutral-700" />
        {/* Import button - hidden on mobile, shown on larger screens */}
        <Input
          ref={inputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => e.target.files && onImport(e.target.files[0], e.target)}
        />
        <Button
          variant="secondary"
          size="sm"
          onClick={() => inputRef.current?.click()}
          className="hidden md:flex"
        >
          <Upload className="h-4 w-4 md:mr-1.5" />
          <span className="sr-only lg:not-sr-only">Import</span>
        </Button>
        {/* Export dropdown - hidden on mobile, shown on larger screens */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="sm" className="hidden md:flex gap-1.5">
              <Download className="h-4 w-4" />
              <span className="sr-only lg:not-sr-only">Export</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onExport}>Export JSON</DropdownMenuItem>
            <DropdownMenuItem onClick={onExportPython}>Export Python</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {/* More menu - shown on mobile only, contains Import, Export, and Examples */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="sm" className="gap-1.5 md:hidden">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">More</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => inputRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />
              Import
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onExport}>
              <Download className="mr-2 h-4 w-4" />
              Export JSON
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onExportPython}>
              <Download className="mr-2 h-4 w-4" />
              Export Python
            </DropdownMenuItem>
            <div className="my-1 h-px bg-neutral-200 dark:bg-neutral-700" />
            <DropdownMenuItem
              onClick={() => {
                const rf = flowJsonToReactFlow(EXAMPLES[0].json as FlowJson);
                setNodes(rf.nodes as FlowNode[]);
                setEdges(rf.edges as FlowEdge[]);
                setTimeout(() => {
                  rfInstance?.fitView?.({ padding: 0.2, duration: 300 });
                }, 100);
              }}
            >
              <FileText className="mr-2 h-4 w-4" />
              {EXAMPLES[0].name}
            </DropdownMenuItem>
            {EXAMPLES.slice(1).map((ex) => (
              <DropdownMenuItem
                key={ex.id}
                onClick={() => {
                  const rf = flowJsonToReactFlow(ex.json as FlowJson);
                  setNodes(rf.nodes as FlowNode[]);
                  setEdges(rf.edges as FlowEdge[]);
                  setTimeout(() => {
                    rfInstance?.fitView?.({ padding: 0.2, duration: 300 });
                  }, 100);
                }}
              >
                <FileText className="mr-2 h-4 w-4" />
                {ex.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            {moreLinks}
          </DropdownMenuContent>
        </DropdownMenu>
        {/* Load Examples dropdown - shown on larger screens only */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="sm" className="hidden md:flex gap-1.5">
              <FileText className="h-4 w-4" />
              <span className="hidden md:inline">Load Example</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {EXAMPLES.map((ex) => (
              <DropdownMenuItem
                key={ex.id}
                onClick={() => {
                  const rf = flowJsonToReactFlow(ex.json as FlowJson);
                  setNodes(rf.nodes as FlowNode[]);
                  setEdges(rf.edges as FlowEdge[]);
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
        <div className="w-px bg-neutral-300 dark:bg-neutral-700" />
        <ThemeSwitch />
        <div className="hidden md:block w-px bg-neutral-300 dark:bg-neutral-700" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="sm" className="hidden md:flex gap-1.5">
              <IconDots className="h-4 w-4" />
              <span className="hidden lg:inline">More</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">{moreLinks}</DropdownMenuContent>
        </DropdownMenu>
      </div>
    </TooltipProvider>
  );
}
