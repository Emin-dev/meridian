"use client";

import { useState, useTransition } from "react";
import { triggerWinLossAnalysis } from "./actions";

interface Props {
  insight: string;
  stage: "won" | "lost";
  dealId: number;
}

export default function WinLossInsightCallout({ insight, stage, dealId }: Props) {
  const isWon = stage === "won";
  const [currentInsight, setCurrentInsight] = useState(insight);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const borderColor = isWon ? "border-[--ok]/40" : "border-[--bad]/40";
  const bgColor = isWon ? "bg-[--ok-tint]" : "bg-[--bad-tint]";
  const iconColor = isWon ? "text-[--ok]" : "text-[--bad]";
  const labelColor = isWon ? "text-[--ok]" : "text-[--bad]";
  const textColor = "text-[--ink-1]";
  const badgeBg = isWon ? "bg-[--ok-tint] text-[--ok]" : "bg-[--bad-tint] text-[--bad]";

  function handleRefresh() {
    setError(null);
    startTransition(async () => {
      const result = await triggerWinLossAnalysis(dealId);
      if (result.insight) {
        setCurrentInsight(result.insight);
      } else if (result.error) {
        setError(result.error);
      } else if (result.noKey) {
        setError("DEEPSEEK_API_KEY is not configured.");
      }
    });
  }

  return (
    <div className={`rounded-xl border ${borderColor} ${bgColor} px-6 py-5`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className={`text-lg ${iconColor}`}>{isWon ? "🏆" : "📉"}</span>
          <div>
            <h3 className={`text-sm font-semibold ${labelColor}`}>
              AI Win/Loss Analysis
            </h3>
            <span className={`inline-block mt-0.5 rounded-full px-2 py-0.5 text-xs font-medium ${badgeBg}`}>
              {isWon ? "Won" : "Lost"}
            </span>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isPending}
          title="Regenerate analysis"
          className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs text-[--ink-2] hover:text-[--ink-1] hover:bg-[--surface-3] transition-colors disabled:opacity-40"
        >
          {isPending ? "Analysing…" : "↻ Refresh"}
        </button>
      </div>

      {error ? (
        <p className="mt-3 text-xs text-[--bad]">{error}</p>
      ) : (
        <p className={`mt-3 text-sm leading-relaxed ${textColor}`}>
          {currentInsight}
        </p>
      )}
    </div>
  );
}
