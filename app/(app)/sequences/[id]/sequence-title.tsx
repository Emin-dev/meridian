"use client";

import { useState, useTransition } from "react";
import { renameSequence } from "./actions";
import { useToast } from "@/components/toaster";

interface Props {
  id: number;
  name: string;
}

export function SequenceTitle({ id, name }: Props) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [isPending, startTransition] = useTransition();

  function cancel() {
    setValue(name);
    setIsEditing(false);
  }

  function save() {
    const trimmed = value.trim();
    if (!trimmed) {
      toast("Name is required.", "error");
      return;
    }
    if (trimmed === name) {
      cancel();
      return;
    }
    startTransition(async () => {
      const result = await renameSequence(id, trimmed);
      if (result?.error) {
        toast(result.error, "error");
      } else {
        toast("Sequence renamed.", "success");
        setIsEditing(false);
      }
    });
  }

  if (!isEditing) {
    return (
      <div className="flex items-center gap-2">
        <h2 className="min-w-0 break-words text-xl font-semibold text-[var(--ink-1)]">
          {name}
        </h2>
        <button
          type="button"
          onClick={() => {
            setValue(name);
            setIsEditing(true);
          }}
          className="tap shrink-0 inline-flex items-center justify-center rounded-[var(--r-md)] px-2 text-xs font-medium text-[var(--ink-3)] transition-colors hover:text-[var(--ink-1)]"
          aria-label="Rename sequence"
        >
          Rename
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="text"
        value={value}
        autoFocus
        maxLength={120}
        disabled={isPending}
        aria-label="Sequence name"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            save();
          } else if (e.key === "Escape") {
            cancel();
          }
        }}
        className="min-w-0 flex-1 rounded-[var(--r-md)] border border-[var(--line-1)] bg-[var(--surface-2)] px-2.5 py-1 text-xl font-semibold text-[var(--ink-1)] outline-none focus:border-[var(--accent)] disabled:opacity-50"
      />
      <button
        type="button"
        onClick={save}
        disabled={isPending}
        className="tap shrink-0 inline-flex items-center justify-center rounded-[var(--r-md)] border border-[var(--accent)]/40 bg-[var(--accent-tint)] px-3 text-xs font-medium text-[var(--accent)] transition-colors hover:opacity-80 disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        onClick={cancel}
        disabled={isPending}
        className="tap shrink-0 inline-flex items-center justify-center rounded-[var(--r-md)] border border-[var(--line-1)] bg-[var(--surface-2)] px-3 text-xs font-medium text-[var(--ink-2)] transition-colors hover:text-[var(--ink-1)] disabled:opacity-50"
      >
        Cancel
      </button>
    </div>
  );
}
