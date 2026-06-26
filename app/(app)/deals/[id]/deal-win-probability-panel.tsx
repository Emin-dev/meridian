"use client";

import { useState, useTransition } from "react";
import { scoreDeal, type DealScoreState } from "./actions";

interface Props {
  dealId: number;
  initialScore?: number | null;
}

function scoreBadgeClass(score: number): string {
  if (score >= 70) return "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30";
  if (score >= 40) return "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30";
  return "bg-red-500/20 text-red-400 ring-1 ring-red-500/30";
}

export default function DealWinProbabilityPanel({ dealId, initialScore }: Props) {
  const [result, setResult] = useState<DealScoreState>({
    score: initialScore ?? undefined,
  });
  const [isPending, startTransition] = useTransition();

  function handleScore() {
    startTransition(async () => {
      const r = await scoreDeal(dealId);
      setResult(r);
    });
  }

  const hasScore = result.score != null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-neutral-300">AI score</h3>
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
          className="rounded-lg bg-[--accent] px-3 py-1.5 text-xs font-medium text-[--accent-ink] transition-colors hover:bg-[--accent-hover] disabled:opacity-50"
        >
          {isPending ? "Scoring…" : hasScore ? "Re-score" : "Score deal"}
        </button>
      </div>

      {result.noDb && (
        <p className="text-xs text-neutral-400">
          Database not connected — cannot load deal data.
        </p>
      )}

      {result.noKey && (
        <p className="text-xs text-amber-400">
          Set{" "}
          <code className="rounded bg-neutral-800 px-1 py-0.5">DEEPSEEK_API_KEY</code>{" "}
          in your environment to enable AI scoring.
        </p>
      )}

      {result.error && <p className="text-xs text-red-400">{result.error}</p>}

      {hasScore && result.reasoning ? (
        <p className="text-sm text-neutral-300 leading-relaxed">{result.reasoning}</p>
      ) : (
        !result.noDb &&
        !result.noKey &&
        !result.error &&
        !isPending && (
          <p className="text-xs text-neutral-500">
            Click &ldquo;Score deal&rdquo; to generate an AI-powered 0–100 win-probability
            estimate based on this deal&apos;s stage, value, close date, and linked contact.
          </p>
        )
      )}
    </div>
  );
}
