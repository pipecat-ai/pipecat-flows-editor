"use client";

import Editor, { type BeforeMount, type Monaco, type OnMount } from "@monaco-editor/react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { editor as MonacoEditor } from "monaco-editor";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";

import { siteButton } from "@/components/site/siteButton";
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
        ? `${warnings} warning${warnings === 1 ? "" : "s"}`
        : "Valid FlowConfig";

  return (
    <>
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 border-t bg-card overflow-hidden ${
          isResizing ? "" : "transition-transform duration-300 ease-in-out"
        } ${showYaml ? "translate-y-0" : "translate-y-full pointer-events-none"}`}
        style={{ height: `${height}px` }}
      >
        <div className="relative h-full flex flex-col pointer-events-auto">
          <div
            className="absolute top-0 left-0 right-0 h-1 cursor-ns-resize hover:bg-sky-500 bg-transparent z-60 pointer-events-auto"
            onMouseDown={handleResizeStart}
          />
          <div className="flex items-center justify-between border-b px-3 py-2 text-xs shrink-0">
            <div className="type-mono-label text-muted-foreground">YAML</div>
            <div
              className={`font-mono ${
                errors > 0
                  ? "text-red-600 dark:text-red-400"
                  : warnings > 0
                    ? "text-orange-600 dark:text-orange-400"
                    : "text-muted-foreground"
              }`}
            >
              {status}
            </div>
          </div>
          <div className="flex-1 min-h-0" data-monaco-editor="">
            {showYaml && <YamlEditor text={text} problems={problems} onChange={onChange} />}
          </div>
        </div>
      </div>
      {/* A tab on the pane's top edge, in the chrome's language. */}
      <button
        type="button"
        className={`type-mono-label fixed left-1/2 z-60 flex h-8 -translate-x-1/2 items-center gap-2 border border-b-0 bg-card px-4 text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring ${
          isResizing ? "" : "transition-all duration-300"
        }`}
        style={{ bottom: showYaml ? `${height}px` : 0 }}
        onClick={() => setShowYaml(!showYaml)}
        aria-expanded={showYaml}
      >
        {showYaml ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
        YAML
      </button>
    </>
  );
}

const MARKER_OWNER = "flow-config";

/*
 * Monaco in the app's palette: the card surface with zinc chrome and a sky
 * cursor, and tokens in the GitHub Light and Dark colors pipecat.ai uses for
 * its code blocks. Hex stands in for the oklch zinc scale, which Monaco
 * cannot read.
 */
const zinc = {
  50: "#fafafa",
  100: "#f4f4f5",
  200: "#e4e4e7",
  300: "#d4d4d8",
  400: "#a1a1aa",
  500: "#71717a",
  600: "#52525b",
  700: "#3f3f46",
  800: "#27272a",
  900: "#18181b",
  950: "#09090b",
};
const sky = { 400: "#38bdf8", 500: "#0ea5e9" };

/* GitHub's syntax colors for YAML: keys, strings, constants, comments. */
const github = {
  light: {
    key: "116329",
    string: "0a3069",
    constant: "0550ae",
    comment: "6e7781",
    punct: "57606a",
  },
  dark: { key: "7ee787", string: "a5d6ff", constant: "79c0ff", comment: "8b949e", punct: "8b949e" },
};

function tokenRules(c: typeof github.light) {
  return [
    { token: "type", foreground: c.key },
    { token: "string", foreground: c.string },
    { token: "number", foreground: c.constant },
    { token: "keyword", foreground: c.constant },
    { token: "namespace", foreground: c.constant },
    { token: "tag", foreground: c.constant },
    { token: "comment", foreground: c.comment, fontStyle: "italic" },
    { token: "operators", foreground: c.punct },
    { token: "delimiter", foreground: c.punct },
  ];
}

function defineThemes(monaco: Monaco) {
  monaco.editor.defineTheme("pipecat-light", {
    base: "vs",
    inherit: true,
    rules: tokenRules(github.light),
    colors: {
      "editor.background": "#ffffff",
      "editor.foreground": zinc[950],
      "editorLineNumber.foreground": zinc[400],
      "editorLineNumber.activeForeground": zinc[950],
      "editor.lineHighlightBackground": zinc[50],
      "editor.lineHighlightBorder": "#00000000",
      "editor.selectionBackground": zinc[200],
      "editor.inactiveSelectionBackground": zinc[100],
      "editorCursor.foreground": sky[500],
      "editorIndentGuide.background1": zinc[200],
      "editorIndentGuide.activeBackground1": zinc[300],
      "editorWidget.background": "#ffffff",
      "editorWidget.border": zinc[200],
      "editorHoverWidget.background": "#ffffff",
      "editorHoverWidget.border": zinc[200],
      "scrollbar.shadow": "#00000000",
      "scrollbarSlider.background": zinc[300] + "80",
      "scrollbarSlider.hoverBackground": zinc[400] + "80",
      "scrollbarSlider.activeBackground": zinc[400],
      focusBorder: "#00000000",
    },
  });
  monaco.editor.defineTheme("pipecat-dark", {
    base: "vs-dark",
    inherit: true,
    rules: tokenRules(github.dark),
    colors: {
      "editor.background": zinc[900],
      "editor.foreground": zinc[50],
      "editorLineNumber.foreground": zinc[600],
      "editorLineNumber.activeForeground": zinc[50],
      "editor.lineHighlightBackground": zinc[800],
      "editor.lineHighlightBorder": "#00000000",
      "editor.selectionBackground": zinc[700],
      "editor.inactiveSelectionBackground": zinc[800],
      "editorCursor.foreground": sky[400],
      "editorIndentGuide.background1": zinc[800],
      "editorIndentGuide.activeBackground1": zinc[700],
      "editorWidget.background": zinc[900],
      "editorWidget.border": zinc[800],
      "editorHoverWidget.background": zinc[900],
      "editorHoverWidget.border": zinc[800],
      "scrollbar.shadow": "#00000000",
      "scrollbarSlider.background": zinc[700] + "80",
      "scrollbarSlider.hoverBackground": zinc[600] + "80",
      "scrollbarSlider.activeBackground": zinc[600],
      focusBorder: "#00000000",
    },
  });
}

/** The page's mono face, resolved from the font variable next/font sets. */
function monoFontFamily() {
  const face = getComputedStyle(document.documentElement).getPropertyValue("--font-geist-mono");
  return [face.trim(), "ui-monospace", "SFMono-Regular", "Menlo", "monospace"]
    .filter(Boolean)
    .join(", ");
}

/** How long Monaco may take to arrive from its CDN before the pane offers a way out. */
const LOAD_PATIENCE_MS = 8000;

/**
 * What the pane shows while Monaco loads. The loader never reports a failed
 * CDN request, so after a while this offers a plain editor and a reload
 * instead of waiting forever.
 */
function EditorLoading({ onFallback }: { onFallback: () => void }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), LOAD_PATIENCE_MS);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-6 text-center text-[13px] text-muted-foreground">
      {slow ? (
        <>
          <p className="max-w-md text-pretty">
            The YAML editor has not loaded from its CDN, which may be blocked on this network. A
            plain editor keeps the document in sync without highlighting or inline problems.
          </p>
          <div className="flex gap-3">
            <button type="button" className={`${siteButton.outline} h-9 px-4`} onClick={onFallback}>
              Use a plain editor
            </button>
            <button
              type="button"
              className={`${siteButton.primary} h-9 px-4`}
              onClick={() => window.location.reload()}
            >
              Reload the page
            </button>
          </div>
        </>
      ) : (
        <p>Loading the YAML editor…</p>
      )}
    </div>
  );
}

/** The document in a text area: the same two-way sync, without Monaco. */
function PlainYamlEditor({ text, onChange }: Pick<Props, "text" | "onChange">) {
  return (
    <textarea
      aria-label="YAML"
      spellCheck={false}
      className="block h-full w-full resize-none bg-card p-3 font-mono text-xs leading-5 text-foreground outline-none"
      value={text}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function YamlEditor({ text, problems, onChange }: Props) {
  const { resolvedTheme } = useTheme();
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const [plain, setPlain] = useState(false);

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

  const beforeMount: BeforeMount = (monaco) => defineThemes(monaco);

  const onMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    editor.updateOptions({ fontFamily: monoFontFamily() });
    applyMarkers(monaco, editor);
  };

  useEffect(() => {
    if (monacoRef.current && editorRef.current) applyMarkers(monacoRef.current, editorRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problems]);

  if (plain) return <PlainYamlEditor text={text} onChange={onChange} />;

  return (
    <Editor
      height="100%"
      language="yaml"
      value={text}
      theme={resolvedTheme === "dark" ? "pipecat-dark" : "pipecat-light"}
      loading={<EditorLoading onFallback={() => setPlain(true)} />}
      beforeMount={beforeMount}
      onMount={onMount}
      onChange={(value) => onChange(value ?? "")}
      options={{
        minimap: { enabled: false },
        fontSize: 12,
        lineHeight: 20,
        tabSize: 2,
        wordWrap: "on",
        scrollBeyondLastLine: false,
        renderValidationDecorations: "on",
        renderLineHighlight: "line",
        lineNumbersMinChars: 3,
        glyphMargin: false,
        folding: false,
        overviewRulerBorder: false,
        hideCursorInOverviewRuler: true,
        padding: { top: 8, bottom: 8 },
        scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
        guides: { indentation: true, bracketPairs: false },
        matchBrackets: "never",
        cursorBlinking: "smooth",
        smoothScrolling: true,
      }}
    />
  );
}
