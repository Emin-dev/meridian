"use client";

import { useState, useTransition } from "react";
import { scoreDeal, type DealScoreState } from "./actions";

interface Props {
  dealId: number;
  initialScore?: number | null;
}

function scoreBadgeClass(score: number): string {
  if (score >= 70) return "bg-[var(--ok-tint)] text-[var(--ok)] ring-1 ring-[var(--ok)]/30";
  if (score >= 40) return "bg-[var(--warn-tint)] text-[var(--warn)] ring-1 ring-[var(--warn)]/30";
  return "bg-[var(--bad-tint)] text-[var(--bad)] ring-1 ring-[var(--bad)]/30";
}

export default function DealWinProbabilityPanel({ dealId, initialScore }: Props) {
  const [result, setResult] = useState<DealScoreState>({
    score: initialScore ?? undefined,
  });
  const [isPending, startTransition] = useTransition();

  function handleScore() {
    setResult((prev) => ({ ...prev, error: undefined }));
    startTransition(async () => {
      try {
        const r = await scoreDeal(dealId);
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
          <h3 className="text-sm font-medium text-[var(--ink-2)]">AI score</h3>
          {hasScore && (
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${scoreBadgeClass(result.score!)}`}
              title={`Win probability: ${result.score}/100`}
            >
              {result.score}%
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleScore}
          disabled={isPending}
          className="tap inline-flex shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] px-3 text-xs font-medium text-[var(--accent-ink)] transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50"
        >
          {isPending ? "Scoring…" : hasScore ? "Re-score" : "Score deal"}
        </button>
      </div>

      {result.noDb && (
        <p className="text-xs text-[var(--ink-2)]">
          Database not connected — cannot load deal data.
        </p>
      )}

      {result.noKey && (
        <p className="text-xs text-[var(--warn)]">
          Set{" "}
          <code className="rounded bg-[var(--surface-2)] px-1 py-0.5">DEEPSEEK_API_KEY</code>{" "}
          in your environment to enable AI scoring.
        </p>
      )}

      {result.error && <p className="text-xs text-[var(--bad)]">{result.error}</p>}

      {hasScore && result.reasoning ? (
        <p className="text-sm text-[var(--ink-2)] leading-relaxed break-words">{result.reasoning}</p>
      ) : (
        !result.noDb &&
        !result.noKey &&
        !result.error &&
        !isPending && (
          <p className="text-xs text-[var(--ink-3)]">
            Click &ldquo;Score deal&rdquo; to generate an AI-powered 0–100 win-probability
            estimate based on this deal&apos;s stage, value, close date, and linked contact.
          </p>
        )
      )}
    </div>
  );
}
