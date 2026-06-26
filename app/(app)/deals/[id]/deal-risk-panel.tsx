"use client";

import { useState, useTransition } from "react";
import { assessDealRisk, type DealRiskState } from "./actions";

interface Props {
  dealId: number;
}

const RISK_META: Record<
  "low" | "medium" | "high",
  { label: string; badge: string; dot: string }
> = {
  low: {
    label: "Low risk",
    badge: "bg-[--ok-tint] text-[--ok] ring-1 ring-[--ok]/30",
    dot: "bg-[--ok]",
  },
  medium: {
    label: "Medium risk",
    badge: "bg-[--warn-tint] text-[--warn] ring-1 ring-[--warn]/30",
    dot: "bg-[--warn]",
  },
  high: {
    label: "High risk",
    badge: "bg-[--bad-tint] text-[--bad] ring-1 ring-[--bad]/30",
    dot: "bg-[--bad]",
  },
};

export default function DealRiskPanel({ dealId }: Props) {
  const [result, setResult] = useState<DealRiskState>({});
  const [isPending, startTransition] = useTransition();

  function handleAssess() {
    startTransition(async () => {
      const r = await assessDealRisk(dealId);
      setResult(r);
    });
  }

  const hasResult = Boolean(result.risk && (result.reason || result.nextStep));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="min-w-0 text-sm font-medium text-[--ink-2]">
          Deal risk &amp; next step
        </h3>
        <button
          type="button"
          onClick={handleAssess}
          disabled={isPending}
          className="inline-flex min-h-[44px] items-center rounded-lg bg-[--accent] px-3 text-xs font-medium text-[--accent-ink] transition-colors hover:bg-[--accent-hover] active:scale-[0.98] disabled:opacity-50"
        >
          {isPending ? "Assessing…" : hasResult ? "Re-assess" : "Assess risk"}
        </button>
      </div>

      {result.noDb && (
        <p className="text-xs text-[--ink-2]">
          Database not connected — cannot load deal data.
        </p>
      )}

      {result.noKey && (
        <p className="text-xs text-[--warn]">
          Set{" "}
          <code className="rounded bg-[--surface-2] px-1 py-0.5">DEEPSEEK_API_KEY</code>{" "}
          in your environment to enable AI risk assessment.
        </p>
      )}

      {result.error && <p className="text-xs text-[--bad]">{result.error}</p>}

      {hasResult ? (
        <div className="space-y-3">
          {result.risk && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${RISK_META[result.risk].badge}`}
            >
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 rounded-full ${RISK_META[result.risk].dot}`}
              />
              {RISK_META[result.risk].label}
            </span>
          )}

          {result.reason && (
            <p className="text-sm leading-relaxed text-[--ink-2]">
              {result.reason}
            </p>
          )}

          {result.nextStep && (
            <div className="flex items-start gap-3 rounded-lg border border-[--accent]/30 bg-[--accent-tint] px-4 py-3">
              <span className="mt-0.5 shrink-0 text-[--accent]">→</span>
              <div className="min-w-0 space-y-0.5">
                <p className="text-caption font-semibold uppercase tracking-wide text-[--ink-3]">
                  Next step
                </p>
                <p className="text-sm font-medium text-[--accent]">
                  {result.nextStep}
                </p>
              </div>
            </div>
          )}
        </div>
      ) : (
        !result.noDb &&
        !result.noKey &&
        !result.error &&
        !isPending && (
          <p className="text-xs text-[--ink-3]">
            Click &ldquo;Assess risk&rdquo; for an AI read on this deal&apos;s risk
            level, the main reason, and the next step to take — based on its stage,
            value, close date, and recent activity.
          </p>
        )
      )}
    </div>
  );
}
