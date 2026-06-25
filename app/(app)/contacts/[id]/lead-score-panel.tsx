"use client";

import { useState, useTransition } from "react";
import { scoreContact, type ScoreState } from "../actions";
import LeadScoreBadge from "../lead-score-badge";

interface Props {
  contactId: number;
  initialScore?: number | null;
  initialRationale?: string | null;
}

export default function LeadScorePanel({ contactId, initialScore, initialRationale }: Props) {
  const [result, setResult] = useState<ScoreState>({
    score: initialScore ?? undefined,
    rationale: initialRationale ?? undefined,
  });
  const [isPending, startTransition] = useTransition();

  function handleScore() {
    startTransition(async () => {
      const r = await scoreContact(contactId);
      setResult(r);
    });
  }

  const hasScore = result.score != null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-neutral-300">Lead score</h3>
          {hasScore && <LeadScoreBadge score={result.score!} />}
        </div>
        <button
          type="button"
          onClick={handleScore}
          disabled={isPending}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
        >
          {isPending ? "Scoring…" : hasScore ? "Re-score" : "Score lead"}
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
          <code className="rounded bg-neutral-800 px-1 py-0.5">DEEPSEEK_API_KEY</code>{" "}
          in your environment to enable lead scoring.
        </p>
      )}

      {result.error && <p className="text-xs text-red-400">{result.error}</p>}

      {hasScore && result.rationale ? (
        <p className="text-sm text-neutral-300 leading-relaxed">{result.rationale}</p>
      ) : (
        !result.noDb &&
        !result.noKey &&
        !result.error &&
        !isPending && (
          <p className="text-xs text-neutral-500">
            Click &ldquo;Score lead&rdquo; to generate an AI-powered 0–100 lead score based on
            this contact&apos;s profile and activity.
          </p>
        )
      )}
    </div>
  );
}
