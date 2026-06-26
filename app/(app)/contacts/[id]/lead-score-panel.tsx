"use client";

import { useState, useTransition } from "react";
import { scoreContact, type ScoreState } from "../actions";
import LeadScoreBadge from "../lead-score-badge";
import AiPanelStatus from "@/components/ai-panel-status";

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
    setResult((prev) => ({ ...prev, error: undefined }));
    startTransition(async () => {
      try {
        const r = await scoreContact(contactId);
        setResult(r);
      } catch {
        setResult((prev) => ({ ...prev, error: "Something went wrong — please try again." }));
      }
    });
  }

  const hasScore = result.score != null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="text-sm font-medium text-[var(--ink-1)]">Lead score</h3>
          {hasScore && <LeadScoreBadge score={result.score!} />}
        </div>
        <button
          type="button"
          onClick={handleScore}
          disabled={isPending}
          className="tap inline-flex shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] px-3 text-xs font-medium text-[var(--accent-ink)] transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50"
        >
          {isPending ? "Scoring…" : hasScore ? "Re-score" : "Score lead"}
        </button>
      </div>

      <AiPanelStatus
        noDb={result.noDb}
        noKey={result.noKey}
        error={result.error}
        keyHint="enable lead scoring."
        hasResult={hasScore && Boolean(result.rationale)}
        isPending={isPending}
        emptyHint={
          <p className="text-xs text-[var(--ink-3)]">
            Click &ldquo;Score lead&rdquo; to generate an AI-powered 0–100 lead score based on
            this contact&apos;s profile and activity.
          </p>
        }
      />

      {hasScore && result.rationale && (
        <p className="text-sm text-[var(--ink-1)] leading-relaxed">{result.rationale}</p>
      )}
    </div>
  );
}
