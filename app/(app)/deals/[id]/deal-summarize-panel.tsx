"use client";

import { useState, useTransition } from "react";
import { summarizeDeal, type DealSummarizeState } from "./actions";
import AiPanelStatus from "@/components/ai-panel-status";

interface Props {
  dealId: number;
  initialSummary?: string | null;
  initialSummaryAt?: Date | null;
}

export default function DealSummarizePanel({ dealId, initialSummary, initialSummaryAt }: Props) {
  const [result, setResult] = useState<DealSummarizeState>({
    summary: initialSummary ?? undefined,
    summaryAt: initialSummaryAt ? initialSummaryAt.toISOString() : undefined,
  });
  const [isPending, startTransition] = useTransition();

  function handleSummarize() {
    setResult((prev) => ({ ...prev, error: undefined }));
    startTransition(async () => {
      try {
        const r = await summarizeDeal(dealId);
        setResult(r);
      } catch {
        setResult((prev) => ({ ...prev, error: "Something went wrong — please try again." }));
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="min-w-0 text-sm font-medium text-[var(--ink-1)]">AI deal brief</h3>
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
            Click &ldquo;Summarise&rdquo; to generate an AI brief of this deal&apos;s status and recent activity.
          </p>
        }
      />

      {isPending && !result.summary && (
        <p className="text-xs text-[var(--ink-3)]">Generating AI brief…</p>
      )}

      {result.summary && (
        <div className="space-y-1.5">
          <p className="text-sm text-[var(--ink-1)] leading-relaxed whitespace-pre-wrap break-words">
            {result.summary}
          </p>
          {result.summaryAt && (
            <p className="text-[11px] text-[var(--ink-3)]">
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
