"use client";

import { ClipboardPaste, FilePlus, FileText, FolderOpen } from "lucide-react";
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

const ACCEPTED_FILES = ".yaml,.yml,.json,application/x-yaml,application/yaml,application/json";

/**
 * The first thing a visitor sees, and what New Flow returns to. Most flows
 * arrive already written, by an agent or by hand, so opening one comes
 * first: a file, a drop, or pasted YAML. Examples and a blank flow follow.
 * Sits over the canvas, so the blank flow is visible behind it and a file
 * dropped anywhere still lands.
 */
export default function StartScreen({ onOpenFlow, onStartFromScratch, onDismiss }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  // Escape dismisses; YAML pasted anywhere while the screen is up opens it
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT")) return;
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
  }, [onOpenFlow, onDismiss]);

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-white/70 p-6 backdrop-blur-sm dark:bg-black/60"
      onClick={onDismiss}
      role="dialog"
      aria-modal="true"
      aria-label="Start a flow"
    >
      <div
        className="grid w-full max-w-4xl gap-4 md:grid-cols-3"
        onClick={(e) => e.stopPropagation()}
      >
        <section className="flex flex-col gap-3 rounded-xl border bg-white p-5 shadow-sm dark:bg-neutral-900 md:col-span-1">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-neutral-500" />
            <h2 className="text-base font-semibold">Open a flow</h2>
          </div>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            A <code>FlowConfig</code> written by an agent or by hand. Pick a file, drop one anywhere
            on the canvas, or paste its YAML.
          </p>
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
          <Button onClick={() => fileInputRef.current?.click()} className="justify-start gap-2">
            <FolderOpen className="h-4 w-4" />
            Choose a file
          </Button>
          <label className="sr-only" htmlFor="start-paste">
            Paste YAML
          </label>
          <textarea
            id="start-paste"
            className="min-h-24 w-full resize-y rounded-md border bg-neutral-50 p-2 font-mono text-xs dark:bg-neutral-950"
            placeholder={"initial_node: greet\nnodes:\n  greet:\n    task_messages: ..."}
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
          />
          <Button
            variant="secondary"
            disabled={!pasted.trim()}
            onClick={() => openText(pasted, DEFAULT_FLOW_NAME)}
            className="justify-start gap-2"
          >
            <ClipboardPaste className="h-4 w-4" />
            Open pasted YAML
          </Button>
        </section>

        <section className="flex flex-col gap-3 rounded-xl border bg-white p-5 shadow-sm dark:bg-neutral-900">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-neutral-500" />
            <h2 className="text-base font-semibold">Start from an example</h2>
          </div>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Pipecat's own flows and a few more, each showing a part of the format.
          </p>
          <ul className="flex flex-col gap-1">
            {EXAMPLES.map((example) => (
              <li key={example.id}>
                <button
                  type="button"
                  className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  onClick={() => openExample(example)}
                >
                  {example.name}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-3 rounded-xl border bg-white p-5 shadow-sm dark:bg-neutral-900">
          <div className="flex items-center gap-2">
            <FilePlus className="h-5 w-5 text-neutral-500" />
            <h2 className="text-base font-semibold">Start from scratch</h2>
          </div>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            A single initial node. Add functions from its "+" and build the graph on the canvas.
          </p>
          <Button variant="secondary" onClick={onStartFromScratch} className="justify-start gap-2">
            <FilePlus className="h-4 w-4" />
            Blank flow
          </Button>
          <p className="mt-auto text-xs text-neutral-500">Press Escape to dismiss.</p>
        </section>
      </div>
    </div>
  );
}
