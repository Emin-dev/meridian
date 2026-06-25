"use client";

import { useState, useTransition } from "react";
import { summarizeContact, type SummarizeState } from "../actions";

interface Props {
  contactId: number;
}

export default function SummarizePanel({ contactId }: Props) {
  const [result, setResult] = useState<SummarizeState>({});
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
        <h3 className="text-sm font-medium text-neutral-300">AI contact brief</h3>
        <button
          type="button"
          onClick={handleSummarize}
          disabled={isPending}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
        >
          {isPending ? "Summarising…" : result.summary ? "Re-summarise" : "Summarise"}
        </button>
      </div>

      {result.noDb && (
        <p className="text-xs text-neutral-400">
          Database not connected — cannot load contact data.
        </p>
      )}

      {result.noKey && (
        <p className="text-xs text-amber-400">
          Set{" "}
          <code className="rounded bg-neutral-800 px-1 py-0.5">
            DEEPSEEK_API_KEY
          </code>{" "}
          in your environment to enable AI summaries.
        </p>
      )}

      {result.error && (
        <p className="text-xs text-red-400">{result.error}</p>
      )}

      {result.summary ? (
        <p className="text-sm text-neutral-300 leading-relaxed whitespace-pre-wrap">
          {result.summary}
        </p>
      ) : (
        !result.noDb &&
        !result.noKey &&
        !result.error &&
        !isPending && (
          <p className="text-xs text-neutral-500">
            Click &ldquo;Summarise&rdquo; to generate an AI brief of this contact&apos;s notes and recent activity.
          </p>
        )
      )}
    </div>
  );
}
