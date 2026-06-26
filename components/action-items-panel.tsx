"use client";

import { useState, useTransition } from "react";
import {
  extractActionItems,
  logAiTaskSuggestion,
  type ActionItem,
  type ExtractActionItemsState,
} from "@/app/(app)/activity/actions";
import { useToast } from "@/components/toaster";

interface Props {
  contactId?: number;
  dealId?: number;
}

const TYPE_CHIP: Record<ActionItem["type"], string> = {
  call:    "bg-[var(--info-tint)] text-[var(--info)]",
  email:   "bg-[var(--accent-tint)] text-[var(--accent)]",
  meeting: "bg-[var(--ok-tint)] text-[var(--ok)]",
  task:    "bg-[var(--surface-3)] text-[var(--ink-2)]",
};

export default function ActionItemsPanel({ contactId, dealId }: Props) {
  const [state, setState] = useState<ExtractActionItemsState>({});
  const [saved, setSaved] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState<Set<number>>(new Set());
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  function handleExtract() {
    setState({});
    setSaved(new Set());
    startTransition(async () => {
      const result = await extractActionItems(contactId ?? null, dealId ?? null);
      setState(result);
    });
  }

  function handleCreateTask(item: ActionItem, index: number) {
    setSaving((prev) => new Set([...prev, index]));
    logAiTaskSuggestion(
      item.title,
      contactId ?? null,
      dealId ?? null,
      item.rationale ?? null,
      item.type,
    ).then((r) => {
      setSaving((prev) => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
      if (r.success) {
        setSaved((prev) => new Set([...prev, index]));
        toast("Task created");
      } else if (r.noDb) {
        toast("Database not connected", "error");
      } else {
        toast(r.error ?? "Failed to create task", "error");
      }
    });
  }

  const hasItems = Array.isArray(state.items);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-[var(--ink-2)]">Action items</h3>
        <button
          type="button"
          onClick={handleExtract}
          disabled={isPending}
          className="tap rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-[var(--accent-ink)] transition-colors hover:bg-[var(--accent-hover)] active:scale-[0.98] disabled:opacity-50"
        >
          {isPending ? "Analyzing…" : hasItems ? "Re-extract" : "Extract"}
        </button>
      </div>

      {state.noDb && (
        <p className="text-xs text-[var(--ink-2)]">
          Database not connected — cannot load data.
        </p>
      )}

      {state.noKey && (
        <p className="text-xs text-[var(--warn)]">
          Set{" "}
          <code className="rounded bg-[var(--surface-2)] px-1 py-0.5">
            DEEPSEEK_API_KEY
          </code>{" "}
          in your environment to enable AI extraction.
        </p>
      )}

      {state.error && (
        <p className="text-xs text-[var(--bad)]">{state.error}</p>
      )}

      {hasItems ? (
        state.items!.length === 0 ? (
          <p className="text-xs text-[var(--ink-3)]">
            No concrete action items found in the current notes and activity.
          </p>
        ) : (
          <ul className="space-y-2">
            {state.items!.map((item, i) => (
              <li
                key={i}
                className="rounded-lg border border-[var(--line-1)] bg-[var(--surface-2)] p-3 space-y-1.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${TYPE_CHIP[item.type]}`}
                      >
                        {item.type}
                      </span>
                      <p className="min-w-0 break-words text-sm text-[var(--ink-1)] leading-snug">
                        {item.title}
                      </p>
                    </div>
                    {item.rationale && (
                      <p className="text-xs text-[var(--ink-3)] leading-relaxed break-words">
                        {item.rationale}
                      </p>
                    )}
                  </div>

                  {saved.has(i) ? (
                    <span className="shrink-0 text-xs text-[var(--ok)] font-medium py-1">
                      ✓ Added
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleCreateTask(item, i)}
                      disabled={saving.has(i)}
                      className="tap shrink-0 rounded-md border border-[var(--line-1)] bg-[var(--surface-1)] px-2.5 py-1 text-xs font-medium text-[var(--ink-2)] hover:border-[var(--line-2)] hover:text-[var(--ink-1)] transition-colors disabled:opacity-50"
                    >
                      {saving.has(i) ? "…" : "Create task"}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )
      ) : (
        !state.noDb &&
        !state.noKey &&
        !state.error &&
        !isPending && (
          <p className="text-xs text-[var(--ink-3)]">
            Click &ldquo;Extract&rdquo; to scan notes and recent activity for
            concrete follow-up items.
          </p>
        )
      )}
    </div>
  );
}
