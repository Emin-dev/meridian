"use client";

import { useEffect } from "react";

export default function RootError({
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
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full items-center justify-center bg-[var(--bg)] text-[var(--ink-1)]">
        <div className="w-full max-w-md rounded-xl border border-[var(--line-1)] bg-[var(--surface-1)] px-8 py-10 text-center">
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
      </body>
    </html>
  );
}
