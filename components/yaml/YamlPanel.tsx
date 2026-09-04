"use client";

import Editor, { type Monaco, type OnMount } from "@monaco-editor/react";
import type { editor as MonacoEditor } from "monaco-editor";
import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import type { FlowProblem } from "@/lib/document/flowDocument";
import { useEditorStore } from "@/lib/store/editorStore";

interface Props {
  text: string;
  problems: FlowProblem[];
  onChange: (text: string) => void;
}

/**
 * The document itself, in a resizable pane under the canvas. Edits here
 * re-parse onto the canvas; edits on the canvas rewrite the text here.
 * Problems from parsing and validation show as markers.
 */
export default function YamlPanel({ text, problems, onChange }: Props) {
  const showYaml = useEditorStore((state) => state.showYaml);
  const setShowYaml = useEditorStore((state) => state.setShowYaml);
  const height = useEditorStore((state) => state.yamlPanelHeight);
  const setHeight = useEditorStore((state) => state.setYamlPanelHeight);
  const isResizing = useEditorStore((state) => state.isYamlPanelResizing);
  const setIsResizing = useEditorStore((state) => state.setIsYamlPanelResizing);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    const startY = e.clientY;
    const startHeight = height;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = startY - moveEvent.clientY; // Inverted because we're dragging up
      setHeight(Math.max(160, Math.min(800, startHeight + delta)));
    };
    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const errors = problems.filter((p) => p.severity === "error").length;
  const warnings = problems.length - errors;
  const status =
    errors > 0
      ? `${errors} error${errors === 1 ? "" : "s"}; the canvas shows the last valid document`
      : warnings > 0
        ? `${warnings} unresolved reference${warnings === 1 ? "" : "s"}`
        : "Valid FlowConfig";

  return (
    <>
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 border-t bg-white dark:bg-neutral-900 overflow-hidden ${
          isResizing ? "" : "transition-transform duration-300 ease-in-out"
        } ${showYaml ? "translate-y-0" : "translate-y-full pointer-events-none"}`}
        style={{ height: `${height}px` }}
      >
        <div className="relative h-full flex flex-col pointer-events-auto">
          <div
            className="absolute top-0 left-0 right-0 h-1 cursor-ns-resize hover:bg-blue-500 bg-transparent z-60 pointer-events-auto"
            onMouseDown={handleResizeStart}
          />
          <div className="flex items-center justify-between border-b px-3 py-2 text-xs shrink-0">
            <div className="font-medium">YAML</div>
            <div
              className={
                errors > 0
                  ? "text-red-600 dark:text-red-400"
                  : warnings > 0
                    ? "text-orange-600 dark:text-orange-400"
                    : "text-neutral-500"
              }
            >
              {status}
            </div>
          </div>
          <div className="flex-1 min-h-0" data-monaco-editor="">
            {showYaml && <YamlEditor text={text} problems={problems} onChange={onChange} />}
          </div>
        </div>
      </div>
      <Button
        variant="secondary"
        size="sm"
        className={`fixed z-60 left-1/2 -translate-x-1/2 ${
          isResizing ? "" : "transition-all duration-300"
        }`}
        style={{ bottom: showYaml ? `${height + 16}px` : "16px" }}
        onClick={() => setShowYaml(!showYaml)}
      >
        {showYaml ? "Hide YAML" : "Show YAML"}
      </Button>
    </>
  );
}

const MARKER_OWNER = "flow-config";

function YamlEditor({ text, problems, onChange }: Props) {
  const { resolvedTheme } = useTheme();
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);

  const applyMarkers = (monaco: Monaco, editor: MonacoEditor.IStandaloneCodeEditor) => {
    const model = editor.getModel();
    if (!model) return;
    monaco.editor.setModelMarkers(
      model,
      MARKER_OWNER,
      problems.map((p) => ({
        message: p.message,
        severity:
          p.severity === "error" ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
        startLineNumber: p.startLine,
        startColumn: p.startColumn,
        endLineNumber: p.endLine,
        endColumn: p.endColumn,
      }))
    );
  };

  const onMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    applyMarkers(monaco, editor);
  };

  useEffect(() => {
    if (monacoRef.current && editorRef.current) applyMarkers(monacoRef.current, editorRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problems]);

  return (
    <Editor
      height="100%"
      language="yaml"
      value={text}
      theme={resolvedTheme === "dark" ? "vs-dark" : "light"}
      onMount={onMount}
      onChange={(value) => onChange(value ?? "")}
      options={{
        minimap: { enabled: false },
        fontSize: 12,
        tabSize: 2,
        wordWrap: "on",
        scrollBeyondLastLine: false,
        renderValidationDecorations: "on",
      }}
    />
  );
}
