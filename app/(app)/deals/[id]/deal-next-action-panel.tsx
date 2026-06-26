"use client";

import { useEffect, useState, useTransition } from "react";
import { suggestDealNextAction, type DealNextActionState } from "./actions";
import { logAiTaskSuggestion } from "@/app/(app)/activity/actions";
import { useToast } from "@/components/toaster";

interface Props {
  dealId: number;
  initialNextAction?: string | null;
  initialNextActionAt?: Date | null;
}

const PRIORITY_STYLES = {
  high: "bg-[var(--bad-tint)] text-[var(--bad)] ring-1 ring-[var(--bad)]/30",
  medium: "bg-[var(--warn-tint)] text-[var(--warn)] ring-1 ring-[var(--warn)]/30",
  low: "bg-[var(--surface-3)] text-[var(--ink-2)] ring-1 ring-[var(--line-2)]",
};

// Rehydrate the last cached suggestion (stored as JSON text on the deal row)
// so the panel shows it on load without a fresh DeepSeek round-trip.
function parseCached(
  raw: string | null | undefined,
  at: Date | null | undefined
): DealNextActionState {
  if (!raw) return {};
  try {
    const p = JSON.parse(raw) as Record<string, unknown>;
    const action = typeof p.action === "string" ? p.action.trim() : "";
    if (!action) return {};
    const priority = (["high", "medium", "low"] as const).includes(
      p.priority as "high" | "medium" | "low"
    )
      ? (p.priority as "high" | "medium" | "low")
      : "medium";
    return {
      action,
      priority,
      rationale: typeof p.rationale === "string" ? p.rationale : undefined,
      suggestedMessage:
        typeof p.suggestedMessage === "string" ? p.suggestedMessage : undefined,
      suggestedAt: at ? at.toISOString() : undefined,
    };
  } catch {
    return {};
  }
}

export default function DealNextActionPanel({
  dealId,
  initialNextAction,
  initialNextActionAt,
}: Props) {
  const [result, setResult] = useState<DealNextActionState>(() =>
    parseCached(initialNextAction, initialNextActionAt)
  );
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isLogging, startLogTransition] = useTransition();
  const { toast } = useToast();

  function handleSuggest() {
    startTransition(async () => {
      try {
        const r = await suggestDealNextAction(dealId);
        setResult(r);
      } catch {
        setResult((prev) => ({ ...prev, error: "Something went wrong — please try again." }));
      }
    });
  }

  // Reset the "Copied!" label after 2s, with cleanup so the timer can't fire
  // on an unmounted component when the user navigates away mid-countdown.
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  function handleCopy() {
    if (!result.suggestedMessage) return;
    navigator.clipboard.writeText(result.suggestedMessage).then(() => {
      setCopied(true);
    });
  }

  function inferType(action: string): "call" | "email" | "meeting" | "task" {
    const s = action.toLowerCase();
    if (s.includes("call") || s.includes("phone")) return "call";
    if (s.includes("email") || s.includes("send") || s.includes("message")) return "email";
    if (s.includes("meeting") || s.includes("meet") || s.includes("demo") || s.includes("schedule")) return "meeting";
    return "task";
  }

  function handleLogAsTask() {
    if (!result.action) return;
    startLogTransition(async () => {
      const type = inferType(result.action!);
      const r = await logAiTaskSuggestion(result.action!, null, dealId, result.suggestedMessage ?? null, type);
      if (r.success) {
        toast("Task saved");
      } else if (r.noDb) {
        toast("Database not connected", "error");
      } else {
        toast(r.error ?? "Failed to log task", "error");
      }
    });
  }

  const hasResult = Boolean(result.action);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="min-w-0 text-sm font-medium text-[var(--ink-2)]">Next best action</h3>
        <button
          type="button"
          onClick={handleSuggest}
          disabled={isPending}
          className="tap inline-flex shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] px-3 text-xs font-medium text-[var(--accent-ink)] transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50"
        >
          {isPending ? "Thinking…" : hasResult ? "Re-suggest" : "Suggest action"}
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
          in your environment to enable AI suggestions.
        </p>
      )}

      {result.error && (
        <p className="text-xs text-[var(--bad)]">{result.error}</p>
      )}

      {hasResult ? (
        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-lg border border-[var(--accent)]/30 bg-[var(--accent-tint)] px-4 py-3">
            <span className="mt-0.5 text-[var(--accent)]">→</span>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm font-medium text-[var(--accent)] break-words">{result.action}</p>
              {result.priority && (
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-caption font-semibold uppercase tracking-wide ${PRIORITY_STYLES[result.priority]}`}
                >
                  {result.priority} priority
                </span>
              )}
            </div>
          </div>

          {/* Save as task */}
          <button
            type="button"
            onClick={handleLogAsTask}
            disabled={isLogging}
            className="tap inline-flex w-full items-center justify-center rounded-lg border border-[var(--line-1)] bg-[var(--surface-2)] px-3 text-xs font-medium text-[var(--ink-2)] transition-colors hover:border-[var(--line-2)] hover:bg-[var(--surface-3)] hover:text-[var(--ink-1)] disabled:opacity-50"
          >
            {isLogging ? "Saving…" : "Save as task"}
          </button>

          {result.rationale && (
            <p className="text-xs text-[var(--ink-2)] leading-relaxed break-words">{result.rationale}</p>
          )}

          {result.suggestedAt && (
            <p className="text-caption text-[var(--ink-3)]">
              Cached suggestion from{" "}
              {new Date(result.suggestedAt).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
              {" · Re-suggest to refresh"}
            </p>
          )}

          {result.suggestedMessage && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-[var(--ink-3)]">Suggested message</p>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="tap inline-flex items-center justify-center rounded-md px-2 text-caption text-[var(--ink-3)] hover:text-[var(--ink-1)] transition-colors"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <pre className="whitespace-pre-wrap break-words rounded-lg border border-[var(--line-1)] bg-[var(--bg)] px-4 py-3 text-xs text-[var(--ink-2)] leading-relaxed font-sans">
                {result.suggestedMessage}
              </pre>
            </div>
          )}
        </div>
      ) : (
        !result.noDb &&
        !result.noKey &&
        !result.error &&
        !isPending && (
          <p className="text-xs text-[var(--ink-3)]">
            Click &ldquo;Suggest action&rdquo; to get an AI-recommended next step based on this
            deal&apos;s stage, value, and recent activity.
          </p>
        )
      )}
    </div>
  );
}
