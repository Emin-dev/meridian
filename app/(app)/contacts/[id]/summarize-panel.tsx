"use client";

import { useState, useTransition } from "react";
import { summarizeContact, type SummarizeState } from "../actions";
import AiPanelStatus from "@/components/ai-panel-status";

interface Props {
  contactId: number;
  initialSummary?: string | null;
  initialSummaryAt?: Date | null;
}

export default function SummarizePanel({ contactId, initialSummary, initialSummaryAt }: Props) {
  const [result, setResult] = useState<SummarizeState>({
    summary: initialSummary ?? undefined,
    summaryAt: initialSummaryAt ? initialSummaryAt.toISOString() : undefined,
  });
  const [isPending, startTransition] = useTransition();

  function handleSummarize() {
    setResult((prev) => ({ ...prev, error: undefined }));
    startTransition(async () => {
      try {
        const r = await summarizeContact(contactId);
        setResult(r);
      } catch {
        setResult((prev) => ({ ...prev, error: "Something went wrong — please try again." }));
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="min-w-0 text-sm font-medium text-[var(--ink-1)]">AI contact brief</h3>
        <button
          type="button"
          onClick={handleSummarize}
          disabled={isPending}
          className="tap inline-flex shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] px-3 text-xs font-medium text-[var(--accent-ink)] transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50"
        >
          {isPending ? "Summarising…" : result.summary ? "Regenerate" : "Summarise"}
        </button>
      </div>

      <AiPanelStatus
        noDb={result.noDb}
        noKey={result.noKey}
        error={result.error}
        keyHint="enable AI summaries."
        hasResult={Boolean(result.summary)}
        isPending={isPending}
        emptyHint={
          <p className="text-xs text-[var(--ink-3)]">
            Click &ldquo;Summarise&rdquo; to generate an AI brief of this contact&apos;s notes and recent activity.
          </p>
        }
      />

      {result.summary && (
        <div className="space-y-1.5">
          <p className="text-sm text-[var(--ink-1)] leading-relaxed whitespace-pre-wrap break-words">
            {result.summary}
          </p>
          {result.summaryAt && (
            <p className="text-caption text-[var(--ink-3)]">
              Cached brief from{" "}
              {new Date(result.summaryAt).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
              {" · Regenerate to refresh"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
