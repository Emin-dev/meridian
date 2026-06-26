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
    badge: "bg-[var(--ok-tint)] text-[var(--ok)] ring-1 ring-[var(--ok)]/30",
    dot: "bg-[var(--ok)]",
  },
  medium: {
    label: "Medium risk",
    badge: "bg-[var(--warn-tint)] text-[var(--warn)] ring-1 ring-[var(--warn)]/30",
    dot: "bg-[var(--warn)]",
  },
  high: {
    label: "High risk",
    badge: "bg-[var(--bad-tint)] text-[var(--bad)] ring-1 ring-[var(--bad)]/30",
    dot: "bg-[var(--bad)]",
  },
};

export default function DealRiskPanel({ dealId }: Props) {
  const [result, setResult] = useState<DealRiskState>({});
  const [isPending, startTransition] = useTransition();

  function handleAssess() {
    setResult((prev) => ({ ...prev, error: undefined }));
    startTransition(async () => {
      try {
        const r = await assessDealRisk(dealId);
        setResult(r);
      } catch {
        setResult((prev) => ({ ...prev, error: "Something went wrong — please try again." }));
      }
    });
  }

  const hasResult = Boolean(result.risk && (result.reason || result.nextStep));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="min-w-0 text-sm font-medium text-[var(--ink-2)]">
          Deal risk &amp; next step
        </h3>
        <button
          type="button"
          onClick={handleAssess}
          disabled={isPending}
          className="inline-flex min-h-[44px] items-center rounded-lg bg-[var(--accent)] px-3 text-xs font-medium text-[var(--accent-ink)] transition-colors hover:bg-[var(--accent-hover)] active:scale-[0.98] disabled:opacity-50"
        >
          {isPending ? "Assessing…" : hasResult ? "Re-assess" : "Assess risk"}
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
          in your environment to enable AI risk assessment.
        </p>
      )}

      {result.error && <p className="text-xs text-[var(--bad)]">{result.error}</p>}

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
            <p className="text-sm leading-relaxed text-[var(--ink-2)]">
              {result.reason}
            </p>
          )}

          {result.nextStep && (
            <div className="flex items-start gap-3 rounded-lg border border-[var(--accent)]/30 bg-[var(--accent-tint)] px-4 py-3">
              <span className="mt-0.5 shrink-0 text-[var(--accent)]">→</span>
              <div className="min-w-0 space-y-0.5">
                <p className="text-caption font-semibold uppercase tracking-wide text-[var(--ink-3)]">
                  Next step
                </p>
                <p className="text-sm font-medium text-[var(--accent)]">
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
          <p className="text-xs text-[var(--ink-3)]">
            Click &ldquo;Assess risk&rdquo; for an AI read on this deal&apos;s risk
            level, the main reason, and the next step to take — based on its stage,
            value, close date, and recent activity.
          </p>
        )
      )}
    </div>
  );
}
