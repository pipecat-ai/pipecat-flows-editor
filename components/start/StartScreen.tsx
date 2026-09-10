"use client";

import { ArrowLeft, ClipboardPaste, FilePlus, FileText, FolderOpen } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import PixelStreams from "@/components/site/PixelStreams";
import { siteButton } from "@/components/site/siteButton";
import { showToast } from "@/components/ui/Toast";
import { DEFAULT_FLOW_NAME, flowNameFromFileName } from "@/lib/document/flowDocument";
import { EXAMPLES, fetchExample, type FlowExample } from "@/lib/examples";
import { readFlowFile } from "@/lib/utils/readFlowFile";

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
 * opening one. Four equal cells in a hairline grid, one click each; paste and
 * examples open a second step in the same panel. Fills the window, since
 * nothing behind it helps with the choice; a file dropped anywhere still
 * lands. Set in the site's language, like the landing page: streams behind,
 * a crosshair frame, square corners, mono-caps buttons.
 */
export default function StartScreen({ onOpenFlow, onStartFromScratch, onDismiss }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<View>("choose");
  const [pasted, setPasted] = useState("");

  const openText = (text: string, flowName: string) => {
    if (onOpenFlow(text, flowName)) onDismiss();
  };

  const openFile = (file: File) => {
    readFlowFile(file)
      .then((text) => openText(text, flowNameFromFileName(file.name)))
      .catch((error: Error) => showToast(error.message, "error"));
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
      className="fixed inset-0 isolate z-50 flex flex-col items-center justify-center overflow-y-auto bg-background p-4 text-foreground sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label="Start a flow"
    >
      <PixelStreams className="-z-10 text-accent-line" />
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

      <div className="crosshair-frame w-full max-w-4xl border bg-card/70">
        {view === "choose" && (
          <>
            <div className="flex flex-col gap-2 border-b p-6 sm:p-8">
              <h1 className="text-2xl font-light sm:text-3xl">
                <strong className="font-semibold">Pipecat Flows</strong> Editor
              </h1>
              <p className="text-sm text-muted-foreground">
                Open a flow written by an agent or by hand. See the graph, validate it, and fix it
                in place.
              </p>
            </div>
            <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
              <Tile
                icon={<FolderOpen className="size-5" />}
                title="Open a file"
                description="A FlowConfig as YAML or JSON."
                onClick={() => fileInputRef.current?.click()}
              />
              <Tile
                icon={<ClipboardPaste className="size-5" />}
                title="Paste YAML"
                description="From a chat, a ticket, or an agent."
                onClick={() => setView("paste")}
              />
              <Tile
                icon={<FileText className="size-5" />}
                title="Start from an example"
                description="Pipecat's own flows and a few more."
                onClick={() => setView("examples")}
              />
              <Tile
                icon={<FilePlus className="size-5" />}
                title="Blank flow"
                description="One initial node; build on the canvas."
                onClick={onStartFromScratch}
              />
            </div>
            <p className="type-mono-label border-t px-6 py-4 text-muted-foreground sm:px-8">
              Drop a YAML file anywhere · Escape for a blank flow
            </p>
          </>
        )}

        {view === "paste" && (
          <>
            <BackRow title="Paste YAML" onBack={() => setView("choose")} />
            <label className="sr-only" htmlFor="start-paste">
              YAML
            </label>
            <textarea
              id="start-paste"
              autoFocus
              className="block h-[55vh] w-full resize-none border-b bg-card p-4 font-mono text-sm outline-none placeholder:text-muted-foreground/60"
              placeholder={
                "initial_node: greet\nnodes:\n  greet:\n    task_messages:\n      - role: developer\n        content: Say hello."
              }
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
            />
            <div className="flex justify-end p-4">
              <button
                type="button"
                className={siteButton.primary}
                disabled={!pasted.trim()}
                onClick={() => openText(pasted, DEFAULT_FLOW_NAME)}
              >
                Open
              </button>
            </div>
          </>
        )}

        {view === "examples" && (
          <>
            <BackRow title="Start from an example" onBack={() => setView("choose")} />
            <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
              {EXAMPLES.map((example) => (
                <Tile
                  key={example.id}
                  icon={<FileText className="size-4" />}
                  title={example.name}
                  description={example.description}
                  onClick={() => openExample(example)}
                  compact
                />
              ))}
            </div>
          </>
        )}
      </div>
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
      className={`flex flex-col items-start gap-2 bg-card text-left transition-colors outline-none hover:bg-accent focus-visible:bg-accent focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 ${
        compact ? "p-4" : "p-6 sm:p-8"
      }`}
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className="font-semibold">{title}</span>
      <span className="text-sm text-muted-foreground">{description}</span>
    </button>
  );
}

function BackRow({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-4 border-b px-4 py-3">
      <button
        type="button"
        onClick={onBack}
        className="type-mono-label inline-flex items-center gap-2 text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ArrowLeft className="size-4" />
        Back
      </button>
      <h2 className="font-semibold">{title}</h2>
    </div>
  );
}
