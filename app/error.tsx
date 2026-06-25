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
      <body className="flex min-h-full items-center justify-center bg-neutral-950 text-neutral-100">
        <div className="w-full max-w-md rounded-xl border border-neutral-800 bg-neutral-900 px-8 py-10 text-center">
          <h2 className="text-base font-semibold text-neutral-100">
            Something went wrong
          </h2>
          <p className="mt-2 text-sm text-neutral-400">
            {error.message || "An unexpected error occurred."}
          </p>
          <button
            onClick={reset}
            className="mt-6 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
