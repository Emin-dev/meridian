"use client";

import { useTransition } from "react";
import { useToast } from "@/components/toaster";
import { bulkScoreContacts } from "./actions";

export default function ScoreAllUnscoredButton({ hasUnscored }: { hasUnscored: boolean }) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  if (!hasUnscored) return null;

  function handleClick() {
    startTransition(async () => {
      const result = await bulkScoreContacts();
      if (result.noDb) {
        toast("Database not connected.", "error");
      } else if (result.noKey) {
        toast("DEEPSEEK_API_KEY is not configured.", "error");
      } else if (result.error) {
        toast(result.error, "error");
      } else {
        const n = result.count ?? 0;
        const failed = result.failed ?? 0;
        const remaining = result.remaining ?? 0;
        const more = remaining > 0 ? ` ${remaining} remaining — run again to continue.` : "";
        if (failed > 0) {
          toast(
            `Scored ${n} contact${n !== 1 ? "s" : ""}, ${failed} failed.${more}`,
            n > 0 ? "success" : "error"
          );
        } else {
          toast(`Scored ${n} contact${n !== 1 ? "s" : ""}.${more}`, "success");
        }
      }
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="flex items-center gap-1.5 rounded-lg border border-[--accent]/30 bg-[--accent-tint] px-3 py-1.5 text-xs font-medium text-[--accent] transition-colors hover:bg-[--accent]/20 disabled:opacity-50"
    >
      {isPending ? (
        <>
          <span className="h-3 w-3 animate-spin rounded-full border border-[--accent] border-t-transparent" />
          Scoring…
        </>
      ) : (
        <>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          Score all unscored
        </>
      )}
    </button>
  );
}
