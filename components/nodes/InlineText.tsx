"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  value: string;
  editing: boolean;
  onStartEdit: () => void;
  /** Called with the typed text on Enter or blur; the caller decides what to store. */
  onCommit: (value: string) => void;
  onCancel: () => void;
  className?: string;
  placeholder?: string;
  ariaLabel: string;
  /** Longer values show their first characters and an ellipsis; the full value is in the tooltip and when editing. */
  maxChars?: number;
}

/**
 * Text that turns into an input on double-click. Enter or leaving the field
 * commits, Escape cancels. Inside a React Flow node the input opts out of
 * dragging so the caret can be placed with the mouse.
 */
export default function InlineText({
  value,
  editing,
  onStartEdit,
  onCommit,
  onCancel,
  className = "",
  placeholder,
  ariaLabel,
  maxChars = 20,
}: Props) {
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const committedRef = useRef(false);

  useEffect(() => {
    if (editing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraft(value);
      committedRef.current = false;
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [editing, value]);

  if (!editing) {
    return (
      <span
        className={`truncate ${className}`}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onStartEdit();
        }}
        title={`${value ? `${value}\n` : ""}Double-click to rename`}
      >
        {value ? (value.length > maxChars ? `${value.slice(0, maxChars)}…` : value) : placeholder}
      </span>
    );
  }

  const commit = () => {
    if (committedRef.current) return;
    committedRef.current = true;
    onCommit(draft);
  };

  return (
    <input
      ref={inputRef}
      className={`nodrag nopan min-w-0 flex-1 rounded border border-blue-500 bg-white px-1 py-0 text-inherit outline-none dark:bg-neutral-900 ${className}`}
      value={draft}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        } else if (e.key === "Escape") {
          committedRef.current = true;
          onCancel();
        }
      }}
      onMouseDown={(e) => e.stopPropagation()}
    />
  );
}
