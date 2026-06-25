"use client";

import { useEffect } from "react";
import { AlertCircleIcon } from "@/components/icons";

export default function AppError({
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
      <div className="w-full max-w-md rounded-xl border border-neutral-800 bg-neutral-900 px-8 py-10 text-center">
        <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-red-900/40">
          <AlertCircleIcon size={20} className="text-red-400" aria-hidden="true" />
        </div>
        <h2 className="text-base font-semibold text-neutral-100">
          Something went wrong
        </h2>
        <p className="mt-2 text-sm text-neutral-400">
          {error.message || "An unexpected error occurred."}
        </p>
        {error.digest && (
          <p className="mt-1 font-mono text-xs text-neutral-600">
            {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          className="mt-6 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
