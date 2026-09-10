"use client";

import { ArrowLeft, ClipboardPaste, FilePlus, FileText, FolderOpen } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { showToast } from "@/components/ui/Toast";
import { DEFAULT_FLOW_NAME, flowNameFromFileName } from "@/lib/document/flowDocument";
import { EXAMPLES, fetchExample, type FlowExample } from "@/lib/examples";

interface Props {
  /** Opens YAML text as the current flow; returns whether it opened. */
  onOpenFlow: (text: string, flowName: string) => boolean;
  /** Keeps the blank flow behind the screen. */
  onStartFromScratch: () => void;
  onDismiss: () => void;
}

type View = "choose" | "paste" | "examples";

const ACCEPTED_FILES = ".yaml,.yml,.json,application/x-yaml,application/yaml,application/json";

/**
 * The first thing a visitor sees, and what New Flow returns to. Most flows
 * arrive already written, by an agent or by hand, so the choices lead with
 * opening one. Four equal tiles, one click each; paste and examples open a
 * second step in the same panel. Fills the window, since nothing behind it
 * helps with the choice; a file dropped anywhere still lands.
 */
export default function StartScreen({ onOpenFlow, onStartFromScratch, onDismiss }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<View>("choose");
  const [pasted, setPasted] = useState("");

  const openText = (text: string, flowName: string) => {
    if (onOpenFlow(text, flowName)) onDismiss();
  };

  const openFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => openText(String(reader.result), flowNameFromFileName(file.name));
    reader.onerror = () => showToast("Could not read the file", "error");
    reader.readAsText(file);
  };

  const openExample = (example: FlowExample) => {
    fetchExample(example)
      .then((text) => openText(text, example.id))
      .catch((error: unknown) => {
        console.error("Failed to load example:", error);
        showToast(`Could not load the ${example.name} example`, "error");
      });
  };

  // Escape steps back, then dismisses. YAML pasted anywhere on the first
  // step opens at once; on the paste step the editor takes it.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (view === "choose") onDismiss();
      else setView("choose");
    };
    const onPaste = (e: ClipboardEvent) => {
      if (view !== "choose") return;
      const text = e.clipboardData?.getData("text/plain")?.trim();
      if (!text) return;
      e.preventDefault();
      openText(text, DEFAULT_FLOW_NAME);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("paste", onPaste);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, onOpenFlow, onDismiss]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-neutral-50 p-6 dark:bg-neutral-950"
      role="dialog"
      aria-modal="true"
      aria-label="Start a flow"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_FILES}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) openFile(file);
          e.target.value = "";
        }}
      />

      {view === "choose" && (
        <>
          <div className="text-center">
            <h1 className="text-2xl font-semibold">Pipecat Flows Editor</h1>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              Open a flow written by an agent or by hand, see it as a graph, and correct it.
            </p>
          </div>
          <div className="grid w-full max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Tile
              icon={<FolderOpen className="h-6 w-6" />}
              title="Open a file"
              description="A FlowConfig as YAML or JSON."
              onClick={() => fileInputRef.current?.click()}
            />
            <Tile
              icon={<ClipboardPaste className="h-6 w-6" />}
              title="Paste YAML"
              description="From a chat, a ticket, or an agent."
              onClick={() => setView("paste")}
            />
            <Tile
              icon={<FileText className="h-6 w-6" />}
              title="Start from an example"
              description="Pipecat's own flows and a few more."
              onClick={() => setView("examples")}
            />
            <Tile
              icon={<FilePlus className="h-6 w-6" />}
              title="Blank flow"
              description="One initial node; build on the canvas."
              onClick={onStartFromScratch}
            />
          </div>
          <p className="text-xs text-neutral-500">
            or drop a YAML file anywhere · press Escape for a blank flow
          </p>
        </>
      )}

      {view === "paste" && (
        <div className="flex w-full max-w-3xl flex-col gap-3">
          <BackRow title="Paste YAML" onBack={() => setView("choose")} />
          <label className="sr-only" htmlFor="start-paste">
            YAML
          </label>
          <textarea
            id="start-paste"
            autoFocus
            className="h-[60vh] w-full resize-none rounded-lg border bg-white p-3 font-mono text-sm dark:bg-neutral-900"
            placeholder={
              "initial_node: greet\nnodes:\n  greet:\n    task_messages:\n      - role: developer\n        content: Say hello."
            }
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
          />
          <div className="flex justify-end">
            <Button disabled={!pasted.trim()} onClick={() => openText(pasted, DEFAULT_FLOW_NAME)}>
              Open
            </Button>
          </div>
        </div>
      )}

      {view === "examples" && (
        <div className="flex w-full max-w-4xl flex-col gap-3">
          <BackRow title="Start from an example" onBack={() => setView("choose")} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {EXAMPLES.map((example) => (
              <Tile
                key={example.id}
                icon={<FileText className="h-5 w-5" />}
                title={example.name}
                description={example.description}
                onClick={() => openExample(example)}
                compact
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Tile({
  icon,
  title,
  description,
  onClick,
  compact,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-start gap-2 rounded-xl border bg-white text-left shadow-sm transition-colors hover:border-blue-500 hover:bg-blue-50/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:bg-neutral-900 dark:hover:bg-blue-950/30 ${
        compact ? "p-4" : "p-5"
      }`}
    >
      <span className="text-neutral-500">{icon}</span>
      <span className="font-semibold">{title}</span>
      <span className="text-sm text-neutral-600 dark:text-neutral-400">{description}</span>
    </button>
  );
}

function BackRow({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>
      <h2 className="text-base font-semibold">{title}</h2>
    </div>
  );
}
