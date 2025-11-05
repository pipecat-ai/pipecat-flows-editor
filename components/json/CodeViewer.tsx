"use client";

import Editor from "@monaco-editor/react";
import { useMemo, useState } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { generatePythonCode } from "@/lib/codegen/pythonGenerator";
import { reactFlowToFlowJson } from "@/lib/convert/flowAdapters";
import { validateFlowJson } from "@/lib/validation/validator";

type Props = {
  nodes: any[];
  edges: any[];
};

export default function CodeViewer({ nodes, edges }: Props) {
  const [activeTab, setActiveTab] = useState("python");

  // Generate JSON from current graph state
  const jsonCode = useMemo(() => {
    try {
      const json = reactFlowToFlowJson(nodes as any, edges as any);
      return JSON.stringify(json, null, 2);
    } catch {
      return "# Error generating JSON";
    }
  }, [nodes, edges]);

  // Generate Python code from current graph state
  const pythonCode = useMemo(() => {
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
  }, [nodes, edges]);

  return (
    <div className="flex h-full w-full flex-col border-t bg-white dark:bg-neutral-900 overflow-hidden pointer-events-auto">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b px-3 py-2 text-xs shrink-0 pointer-events-auto">
          <TabsList className="h-7">
            <TabsTrigger value="python" className="text-xs px-2 py-1">
              Python
            </TabsTrigger>
            <TabsTrigger value="json" className="text-xs px-2 py-1">
              JSON
            </TabsTrigger>
          </TabsList>
          <div className="text-neutral-500 text-[10px]">Read-only preview</div>
        </div>
        <TabsContent value="python" className="flex-1 min-h-0 relative pointer-events-auto mt-0">
          <Editor
            height="100%"
            language="python"
            value={pythonCode}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              fontSize: 12,
              wordWrap: "on",
              readOnly: true,
            }}
          />
        </TabsContent>
        <TabsContent value="json" className="flex-1 min-h-0 relative pointer-events-auto mt-0">
          <Editor
            height="100%"
            language="json"
            value={jsonCode}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              fontSize: 12,
              wordWrap: "on",
              readOnly: true,
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
