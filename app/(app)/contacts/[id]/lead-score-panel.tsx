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
          <h3 className="text-sm font-medium text-[--ink-1]">Lead score</h3>
          {hasScore && <LeadScoreBadge score={result.score!} />}
        </div>
        <button
          type="button"
          onClick={handleScore}
          disabled={isPending}
          className="rounded-lg bg-[--accent] px-3 py-1.5 text-xs font-medium text-[--accent-ink] transition-colors hover:bg-[--accent-hover] disabled:opacity-50"
        >
          {isPending ? "Scoring…" : hasScore ? "Re-score" : "Score lead"}
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
          <code className="rounded bg-[--surface-2] px-1 py-0.5">DEEPSEEK_API_KEY</code>{" "}
          in your environment to enable lead scoring.
        </p>
      )}

      {result.error && <p className="text-xs text-[--bad]">{result.error}</p>}

      {hasScore && result.rationale ? (
        <p className="text-sm text-[--ink-1] leading-relaxed">{result.rationale}</p>
      ) : (
        !result.noDb &&
        !result.noKey &&
        !result.error &&
        !isPending && (
          <p className="text-xs text-[--ink-3]">
            Click &ldquo;Score lead&rdquo; to generate an AI-powered 0–100 lead score based on
            this contact&apos;s profile and activity.
          </p>
        )
      )}
    </div>
  );
}
