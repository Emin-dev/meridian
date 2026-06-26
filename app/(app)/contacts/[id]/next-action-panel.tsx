"use client";

import { useState, useTransition } from "react";
import { suggestNextAction, type NextActionState } from "../actions";
import { logAiTaskSuggestion } from "@/app/(app)/activity/actions";
import { useToast } from "@/components/toaster";
import AiPanelStatus from "@/components/ai-panel-status";

interface Props {
  contactId: number;
  initialNextAction?: string | null;
  initialNextActionAt?: Date | null;
}

const PRIORITY_STYLES = {
  high: "bg-[--bad-tint] text-[--bad] ring-1 ring-[--bad]/30",
  medium: "bg-[--warn-tint] text-[--warn] ring-1 ring-[--warn]/30",
  low: "bg-[--surface-2] text-[--ink-2] ring-1 ring-[--line-2]",
};

// Rehydrate the last cached suggestion (stored as JSON text on the contact row)
// so the panel shows it on load without a fresh DeepSeek round-trip.
function parseCached(
  raw: string | null | undefined,
  at: Date | null | undefined
): NextActionState {
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

export default function NextActionPanel({
  contactId,
  initialNextAction,
  initialNextActionAt,
}: Props) {
  const [result, setResult] = useState<NextActionState>(() =>
    parseCached(initialNextAction, initialNextActionAt)
  );
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isLogging, startLogTransition] = useTransition();
  const { toast } = useToast();

  function handleSuggest() {
    startTransition(async () => {
      const r = await suggestNextAction(contactId);
      setResult(r);
    });
  }

  function handleCopy() {
    if (!result.suggestedMessage) return;
    navigator.clipboard.writeText(result.suggestedMessage).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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
      const r = await logAiTaskSuggestion(result.action!, contactId, null, result.suggestedMessage ?? null, type);
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
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[--ink-1]">Next best action</h3>
        <button
          type="button"
          onClick={handleSuggest}
          disabled={isPending}
          className="tap inline-flex items-center justify-center rounded-lg bg-[--accent] px-3 text-xs font-medium text-[--accent-ink] transition-colors hover:bg-[--accent-hover] disabled:opacity-50"
        >
          {isPending ? "Thinking…" : hasResult ? "Re-suggest" : "Suggest action"}
        </button>
      </div>

      <AiPanelStatus
        noDb={result.noDb}
        noKey={result.noKey}
        error={result.error}
        keyHint="enable AI suggestions."
        hasResult={hasResult}
        isPending={isPending}
        emptyHint={
          <p className="text-xs text-[--ink-3]">
            Click &ldquo;Suggest action&rdquo; to get an AI-recommended next step based on this
            contact&apos;s profile, lead score, and recent activity.
          </p>
        }
      />

      {hasResult && (
        <div className="space-y-3">
          {/* Recommended action */}
          <div className="flex items-start gap-3 rounded-lg border border-[--accent]/30 bg-[--accent-tint] px-4 py-3">
            <span className="mt-0.5 text-[--accent]">→</span>
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium text-[--ink-1]">{result.action}</p>
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
            className="tap inline-flex w-full items-center justify-center rounded-lg border border-[--line-1] bg-[--surface-2] px-3 text-xs font-medium text-[--ink-1] transition-colors hover:border-[--line-2] hover:bg-[--surface-3] disabled:opacity-50"
          >
            {isLogging ? "Saving…" : "Save as task"}
          </button>

          {/* Rationale */}
          {result.rationale && (
            <p className="text-xs text-[--ink-2] leading-relaxed">{result.rationale}</p>
          )}

          {result.suggestedAt && (
            <p className="text-caption text-[--ink-3]">
              Cached suggestion from{" "}
              {new Date(result.suggestedAt).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
              {" · Re-suggest to refresh"}
            </p>
          )}

          {/* Suggested message */}
          {result.suggestedMessage && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-[--ink-3]">Suggested message</p>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="tap inline-flex items-center justify-center rounded-md px-2 text-caption text-[--ink-3] hover:text-[--ink-1] transition-colors"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <pre className="whitespace-pre-wrap rounded-lg border border-[--line-1] bg-[--bg] px-4 py-3 text-xs text-[--ink-1] leading-relaxed font-sans">
                {result.suggestedMessage}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
