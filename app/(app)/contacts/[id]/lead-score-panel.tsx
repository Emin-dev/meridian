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
          className="tap inline-flex items-center justify-center rounded-lg bg-[--accent] px-3 text-xs font-medium text-[--accent-ink] transition-colors hover:bg-[--accent-hover] disabled:opacity-50"
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
          <p className="text-xs text-[--ink-3]">
            Click &ldquo;Score lead&rdquo; to generate an AI-powered 0–100 lead score based on
            this contact&apos;s profile and activity.
          </p>
        }
      />

      {hasScore && result.rationale && (
        <p className="text-sm text-[--ink-1] leading-relaxed">{result.rationale}</p>
      )}
    </div>
  );
}
