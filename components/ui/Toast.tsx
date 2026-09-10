"use client";

import { useEffect, useState } from "react";

import { useEditorStore } from "@/lib/store/editorStore";

type ToastType = "success" | "error" | "info";

type Toast = {
  id: string;
  message: string;
  type: ToastType;
};

let toastId = 0;
const listeners = new Set<(toasts: Toast[]) => void>();
let toasts: Toast[] = [];

function notify() {
  listeners.forEach((fn) => fn([...toasts]));
}

export function showToast(message: string, type: ToastType = "info") {
  const id = (toastId++).toString();
  toasts.push({ id, message, type });
  notify();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    notify();
  }, 4000);
}

/**
 * Toasts stack up from the canvas's bottom-right corner, clear of the
 * toolbar, the zoom controls, and the YAML tab, and above the YAML pane
 * when it is open. Mount it inside the canvas container.
 */
export default function ToastContainer() {
  const [current, setCurrent] = useState<Toast[]>([]);
  const showYaml = useEditorStore((state) => state.showYaml);
  const yamlHeight = useEditorStore((state) => state.yamlPanelHeight);

  useEffect(() => {
    listeners.add(setCurrent);
    return () => {
      listeners.delete(setCurrent);
    };
  }, []);

  return (
    <div
      className="pointer-events-none absolute right-4 z-40 flex flex-col-reverse items-end gap-2 transition-[bottom] duration-300"
      style={{ bottom: showYaml ? yamlHeight + 16 : 16 }}
    >
      {current.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto border border-l-2 bg-card px-4 py-2 text-sm text-foreground ${
            toast.type === "error"
              ? "border-l-red-500"
              : toast.type === "success"
                ? "border-l-green-500"
                : "border-l-sky-500"
          }`}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
