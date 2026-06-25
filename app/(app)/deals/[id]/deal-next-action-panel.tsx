"use client";

import { useState, useTransition } from "react";
import { suggestDealNextAction, type DealNextActionState } from "./actions";
import { logAiTaskSuggestion } from "@/app/(app)/activity/actions";
import { useToast } from "@/components/toaster";

interface Props {
  dealId: number;
}

const PRIORITY_STYLES = {
  high: "bg-red-500/15 text-red-400 ring-1 ring-red-500/30",
  medium: "bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30",
  low: "bg-neutral-700 text-neutral-400 ring-1 ring-neutral-600",
};

export default function DealNextActionPanel({ dealId }: Props) {
  const [result, setResult] = useState<DealNextActionState>({});
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isLogging, startLogTransition] = useTransition();
  const { toast } = useToast();

  function handleSuggest() {
    startTransition(async () => {
      const r = await suggestDealNextAction(dealId);
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

  function handleLogAsTask() {
    if (!result.action) return;
    startLogTransition(async () => {
      const r = await logAiTaskSuggestion(result.action!, null, dealId);
      if (r.success) {
        toast("Task logged successfully");
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
          Database not connected — cannot load deal data.
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

          {/* Log as task */}
          <button
            type="button"
            onClick={handleLogAsTask}
            disabled={isLogging}
            className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-xs font-medium text-neutral-300 transition-colors hover:border-neutral-600 hover:bg-neutral-700 hover:text-white disabled:opacity-50"
          >
            {isLogging ? "Logging…" : "Log as task"}
          </button>

          {result.rationale && (
            <p className="text-xs text-neutral-400 leading-relaxed">{result.rationale}</p>
          )}

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
            deal&apos;s stage, value, and recent activity.
          </p>
        )
      )}
    </div>
  );
}
