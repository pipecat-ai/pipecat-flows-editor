"use client";

import { useEffect, useState } from "react";

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

export default function ToastContainer() {
  const [current, setCurrent] = useState<Toast[]>([]);

  useEffect(() => {
    listeners.add(setCurrent);
    return () => {
      listeners.delete(setCurrent);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed right-76 top-20 z-50 flex flex-col gap-2">
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
