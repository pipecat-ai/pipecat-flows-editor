"use client";

import { IconBook, IconBrandGithub, IconDots, IconHome } from "@tabler/icons-react";
import {
  Download,
  FilePlusCorner,
  FileText,
  FolderOpen,
  LayoutGrid,
  MoreHorizontal,
  Redo2,
  Undo2,
  Workflow,
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
import { FLOW_FILE_EXTENSION, flowNameFromFileName } from "@/lib/document/flowDocument";
import { serializeFlow } from "@/lib/document/serializeFlow";
import { EXAMPLES, fetchExample, type FlowExample } from "@/lib/examples";
import { useEditorStore } from "@/lib/store/editorStore";
import { useFlowStore } from "@/lib/store/flowStore";
import type { FlowNode } from "@/lib/types/flowTypes";
import { formatFlowConfigError } from "@/lib/validation/flowConfigValidator";

type Props = {
  nodes: FlowNode[];
  onOpenFlow: (text: string, flowName: string) => void;
  onAutoLayout: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onNewFlow: () => void;
};

const ACCEPTED_FILES = ".yaml,.yml,.json,application/x-yaml,application/yaml,application/json";

export default function Toolbar({
  nodes,
  onOpenFlow,
  onAutoLayout,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onNewFlow,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const showFlowPanel = useEditorStore((state) => state.showFlowPanel);
  const setShowFlowPanel = useEditorStore((state) => state.setShowFlowPanel);
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);
  const flowName = useFlowStore((state) => state.flowName);

  const flowPanelOpen = showFlowPanel && !selectedNodeId;
  function toggleFlowPanel() {
    if (flowPanelOpen) {
      setShowFlowPanel(false);
      return;
    }
    const editor = useEditorStore.getState();
    editor.clearSelection();
    editor.rfInstance?.setNodes((nds) => nds.map((node) => ({ ...node, selected: false })));
    setShowFlowPanel(true);
  }

  function onSave() {
    const { document, globalFunctions } = useFlowStore.getState();
    const { text, referenceErrors } = serializeFlow(nodes, { document, globalFunctions });
    const blob = new Blob([text], { type: "application/yaml" });
    const a = window.document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${flowName}${FLOW_FILE_EXTENSION}`;
    a.click();
    URL.revokeObjectURL(a.href);
    if (referenceErrors.length > 0) {
      showToast(
        `Saved with ${referenceErrors.length} unresolved reference${referenceErrors.length === 1 ? "" : "s"}: ${formatFlowConfigError(referenceErrors[0])}`,
        "info"
      );
    } else {
      showToast(`Saved ${flowName}${FLOW_FILE_EXTENSION}`, "success");
    }
  }

  function onOpenFile(file: File, input: HTMLInputElement) {
    const reader = new FileReader();
    reader.onload = () => {
      onOpenFlow(String(reader.result), flowNameFromFileName(file.name));
      input.value = "";
    };
    reader.onerror = () => showToast("Could not read the file", "error");
    reader.readAsText(file);
  }

  function onLoadExample(example: FlowExample) {
    fetchExample(example)
      .then((text) => onOpenFlow(text, example.id))
      .catch((error: unknown) => {
        console.error("Failed to load example:", error);
        showToast(`Could not load the ${example.name} example`, "error");
      });
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
      <div className="absolute top-2 md:top-4 left-2 z-10 flex gap-2 rounded-md bg-white/80 p-2 text-sm shadow backdrop-blur dark:bg-black/40">
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
        <Input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_FILES}
          className="hidden"
          onChange={(e) => e.target.files && onOpenFile(e.target.files[0], e.target)}
        />
        {/* Open and Save - hidden on mobile, shown on larger screens */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => inputRef.current?.click()}
              className="hidden md:flex"
            >
              <FolderOpen className="h-4 w-4 md:mr-1.5" />
              <span className="sr-only lg:not-sr-only">Open</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Open a flow config (YAML or JSON)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="secondary" size="sm" onClick={onSave} className="hidden md:flex">
              <Download className="h-4 w-4 md:mr-1.5" />
              <span className="sr-only lg:not-sr-only">Save</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Save as {flowName}
            {FLOW_FILE_EXTENSION}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="secondary" size="sm" onClick={onAutoLayout} className="hidden md:flex">
              <LayoutGrid className="h-4 w-4 md:mr-1.5" />
              <span className="sr-only lg:not-sr-only">Layout</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Lay the nodes out automatically</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={flowPanelOpen ? "default" : "secondary"}
              size="sm"
              onClick={toggleFlowPanel}
              className="hidden md:flex"
            >
              <Workflow className="h-4 w-4 md:mr-1.5" />
              <span className="sr-only lg:not-sr-only">Flow</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Global functions, referenced tools, and variables</TooltipContent>
        </Tooltip>
        {/* More menu - shown on mobile only, contains Open, Save, and Examples */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="sm" className="gap-1.5 md:hidden">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">More</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => inputRef.current?.click()}>
              <FolderOpen className="mr-2 h-4 w-4" />
              Open
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onSave}>
              <Download className="mr-2 h-4 w-4" />
              Save
            </DropdownMenuItem>
            <DropdownMenuItem onClick={toggleFlowPanel}>
              <Workflow className="mr-2 h-4 w-4" />
              Flow
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onAutoLayout}>
              <LayoutGrid className="mr-2 h-4 w-4" />
              Layout
            </DropdownMenuItem>
            <div className="my-1 h-px bg-neutral-200 dark:bg-neutral-700" />
            {EXAMPLES.map((example) => (
              <DropdownMenuItem key={example.id} onClick={() => onLoadExample(example)}>
                <FileText className="mr-2 h-4 w-4" />
                {example.name}
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
            {EXAMPLES.map((example) => (
              <DropdownMenuItem key={example.id} onClick={() => onLoadExample(example)}>
                {example.name}
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
