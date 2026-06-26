"use client";

import { useEffect } from "react";
import { AlertCircleIcon } from "@/components/icons";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex items-center justify-center py-24">
      <div className="w-full max-w-md rounded-xl border border-[var(--line-1)] bg-[var(--surface-1)] px-8 py-10 text-center">
        <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--bad-tint)]">
          <AlertCircleIcon size={20} className="text-[var(--bad)]" aria-hidden="true" />
        </div>
        <h2 className="text-base font-semibold text-[var(--ink-1)]">
          Something went wrong
        </h2>
        <p className="mt-2 text-sm text-[var(--ink-2)]">
          {error.message || "An unexpected error occurred."}
        </p>
        {error.digest && (
          <p className="mt-1 font-mono text-xs text-[var(--ink-3)]">
            {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          className="mt-6 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-ink)] transition-colors hover:bg-[var(--accent-hover)]"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
