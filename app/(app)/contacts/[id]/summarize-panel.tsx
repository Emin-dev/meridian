"use client";

import { useState, useTransition } from "react";
import { summarizeContact, type SummarizeState } from "../actions";

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
    startTransition(async () => {
      const r = await summarizeContact(contactId);
      setResult(r);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[--ink-1]">AI contact brief</h3>
        <button
          type="button"
          onClick={handleSummarize}
          disabled={isPending}
          className="rounded-lg bg-[--accent] px-3 py-1.5 text-xs font-medium text-[--accent-ink] transition-colors hover:bg-[--accent-hover] disabled:opacity-50"
        >
          {isPending ? "Summarising…" : result.summary ? "Regenerate" : "Summarise"}
        </button>
      </div>

      {result.noDb && (
        <p className="text-xs text-[--ink-2]">
          Database not connected — cannot load contact data.
        </p>
      )}

      {result.noKey && (
        <p className="text-xs text-[--warn]">
          Set{" "}
          <code className="rounded bg-[--surface-2] px-1 py-0.5">
            DEEPSEEK_API_KEY
          </code>{" "}
          in your environment to enable AI summaries.
        </p>
      )}

      {result.error && (
        <p className="text-xs text-[--bad]">{result.error}</p>
      )}

      {result.summary ? (
        <div className="space-y-1.5">
          <p className="text-sm text-[--ink-1] leading-relaxed whitespace-pre-wrap">
            {result.summary}
          </p>
          {result.summaryAt && (
            <p className="text-[11px] text-[--ink-3]">
              Cached brief from{" "}
              {new Date(result.summaryAt).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
              {" · Regenerate to refresh"}
            </p>
          )}
        </div>
      ) : (
        !result.noDb &&
        !result.noKey &&
        !result.error &&
        !isPending && (
          <p className="text-xs text-[--ink-3]">
            Click &ldquo;Summarise&rdquo; to generate an AI brief of this contact&apos;s notes and recent activity.
          </p>
        )
      )}
    </div>
  );
}
