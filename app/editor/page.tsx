"use client";

import dynamic from "next/dynamic";

const EditorShell = dynamic(() => import("@/components/EditorShell"), { ssr: false });

export default function EditorPage() {
  return (
    <div className="fixed inset-0 bg-background">
      <EditorShell />
    </div>
  );
}
