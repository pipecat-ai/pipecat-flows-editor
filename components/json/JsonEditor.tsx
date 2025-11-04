"use client";

import Editor from "@monaco-editor/react";
import { useMemo, useState } from "react";
import { reactFlowToFlowJson } from "@/lib/convert/flowAdapters";
import { validateFlowJson } from "@/lib/validation/validator";
import { generatePythonCode } from "@/lib/codegen/pythonGenerator";

type ViewMode = "json" | "python";

type Props = {
  nodes: any[];
  edges: any[];
};

export default function JsonEditor({ nodes, edges }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>("json");

  // Generate JSON from current graph state
  const jsonCode = useMemo(() => {
    if (viewMode !== "json") return "";
    try {
      const json = reactFlowToFlowJson(nodes as any, edges as any);
      return JSON.stringify(json, null, 2);
    } catch {
      return "# Error generating JSON";
    }
  }, [nodes, edges, viewMode]);

  // Generate Python code from current graph state
  const pythonCode = useMemo(() => {
    if (viewMode !== "python") return "";
    try {
      const json = reactFlowToFlowJson(nodes as any, edges as any);
      const validation = validateFlowJson(json);
      if (validation.valid) {
        return generatePythonCode(json);
      }
      return "# Flow must be valid to generate Python code\n# Please fix validation errors";
    } catch {
      return "# Error generating Python code";
    }
  }, [nodes, edges, viewMode]);

  const currentValue = viewMode === "json" ? jsonCode : pythonCode;
  const currentLanguage = viewMode === "json" ? "json" : "python";

  return (
    <div className="flex h-full w-full flex-col border-t bg-white dark:bg-neutral-900 overflow-hidden">
      <div className="flex items-center justify-between border-b px-3 py-2 text-xs shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode("json")}
            className={`px-2 py-1 rounded text-xs transition-colors ${
              viewMode === "json"
                ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-medium"
                : "hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
            }`}
          >
            JSON
          </button>
          <button
            onClick={() => setViewMode("python")}
            className={`px-2 py-1 rounded text-xs transition-colors ${
              viewMode === "python"
                ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-medium"
                : "hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
            }`}
          >
            Python
          </button>
        </div>
        <div className="text-neutral-500 text-[10px]">Read-only preview</div>
      </div>
      <div className="flex-1 min-h-0 relative">
        <Editor
          height="100%"
          language={currentLanguage}
          value={currentValue}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 12,
            wordWrap: "on",
            readOnly: true,
          }}
        />
      </div>
    </div>
  );
}
