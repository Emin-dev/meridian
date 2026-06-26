"use client";

import { useState, useTransition } from "react";
import { suggestNextAction, type NextActionState } from "../actions";
import { logAiTaskSuggestion } from "@/app/(app)/activity/actions";
import { useToast } from "@/components/toaster";

interface Props {
  contactId: number;
  initialNextAction?: string | null;
  initialNextActionAt?: Date | null;
}

const PRIORITY_STYLES = {
  high: "bg-red-500/15 text-red-400 ring-1 ring-red-500/30",
  medium: "bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30",
  low: "bg-neutral-700 text-neutral-400 ring-1 ring-neutral-600",
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
        <h3 className="text-sm font-medium text-neutral-300">Next best action</h3>
        <button
          type="button"
          onClick={handleSuggest}
          disabled={isPending}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
        >
          {isPending ? "Thinking…" : hasResult ? "Re-suggest" : "Suggest action"}
        </button>
      </div>

      {result.noDb && (
        <p className="text-xs text-neutral-400">
          Database not connected — cannot load contact data.
        </p>
      )}

      {result.noKey && (
        <p className="text-xs text-amber-400">
          Set{" "}
          <code className="rounded bg-neutral-800 px-1 py-0.5">DEEPSEEK_API_KEY</code>{" "}
          in your environment to enable AI suggestions.
        </p>
      )}

      {result.error && (
        <p className="text-xs text-red-400">{result.error}</p>
      )}

      {hasResult ? (
        <div className="space-y-3">
          {/* Recommended action */}
          <div className="flex items-start gap-3 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-4 py-3">
            <span className="mt-0.5 text-indigo-400">→</span>
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium text-indigo-300">{result.action}</p>
              {result.priority && (
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${PRIORITY_STYLES[result.priority]}`}
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
            className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-xs font-medium text-neutral-300 transition-colors hover:border-neutral-600 hover:bg-neutral-700 hover:text-white disabled:opacity-50"
          >
            {isLogging ? "Saving…" : "Save as task"}
          </button>

          {/* Rationale */}
          {result.rationale && (
            <p className="text-xs text-neutral-400 leading-relaxed">{result.rationale}</p>
          )}

          {result.suggestedAt && (
            <p className="text-[11px] text-neutral-500">
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
                <p className="text-xs font-medium text-neutral-500">Suggested message</p>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="text-[10px] text-neutral-500 hover:text-neutral-300 transition-colors"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <pre className="whitespace-pre-wrap rounded-lg border border-neutral-800 bg-neutral-950 px-4 py-3 text-xs text-neutral-300 leading-relaxed font-sans">
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
          <p className="text-xs text-neutral-500">
            Click &ldquo;Suggest action&rdquo; to get an AI-recommended next step based on this
            contact&apos;s profile, lead score, and recent activity.
          </p>
        )
      )}
    </div>
  );
}
