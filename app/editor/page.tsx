"use client";

import dynamic from "next/dynamic";

const EditorShell = dynamic(() => import("@/components/EditorShell"), { ssr: false });

export default function EditorPage() {
  return <EditorShell />;
}
