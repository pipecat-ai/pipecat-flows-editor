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
          className={`pointer-events-auto rounded-md border px-4 py-2 text-sm shadow-lg backdrop-blur ${
            toast.type === "error"
              ? "border-red-400 bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100"
              : toast.type === "success"
                ? "border-green-400 bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-100"
                : "border-blue-400 bg-blue-50 text-blue-900 dark:bg-blue-950 dark:text-blue-100"
          }`}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
