"use client";

import { useState, useTransition } from "react";
import { findDuplicateContacts, mergeContacts } from "./actions";
import type { DuplicatePair } from "./actions";
import { useOverlayDismiss } from "@/hooks/use-overlay-dismiss";

const CONFIDENCE_STYLES: Record<"high" | "medium" | "low", string> = {
  high: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  medium: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  low: "bg-neutral-700 text-neutral-400 border border-neutral-600",
};

export default function FindDuplicatesButton({ hasDb }: { hasDb: boolean }) {
  const [open, setOpen] = useState(false);
  const [pairs, setPairs] = useState<DuplicatePair[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [confirmingKey, setConfirmingKey] = useState<string | null>(null);
  const [mergingKey, setMergingKey] = useState<string | null>(null);
  const [pairErrors, setPairErrors] = useState<Record<string, string>>({});
  const panelRef = useOverlayDismiss<HTMLDivElement>(open, () => setOpen(false));

  function pairKey(p: DuplicatePair) {
    return `${p.primaryId}-${p.secondaryId}`;
  }

  function handleOpen() {
    // Never let two overlays stack: close any open native <dialog> first.
    document
      .querySelectorAll("dialog[open]")
      .forEach((d) => (d as HTMLDialogElement).close());
    setOpen(true);
    setSearched(false);
    setPairs([]);
    setErrorMsg(null);
    setConfirmingKey(null);
    setPairErrors({});
  }

  function handleScan() {
    startTransition(async () => {
      setSearched(false);
      setErrorMsg(null);
      setPairErrors({});
      const result = await findDuplicateContacts();
      setSearched(true);
      if (result.noDb) setErrorMsg("Database not connected.");
      else if (result.noKey) setErrorMsg("DEEPSEEK_API_KEY is not configured.");
      else if (result.error) setErrorMsg(result.error);
      else setPairs(result.pairs ?? []);
    });
  }

  function handleMerge(pair: DuplicatePair) {
    const key = pairKey(pair);
    setMergingKey(key);
    startTransition(async () => {
      const result = await mergeContacts(pair.primaryId, pair.secondaryId);
      setMergingKey(null);
      setConfirmingKey(null);
      if (result.success) {
        setPairs((prev) =>
          prev.filter((p) => pairKey(p) !== key)
        );
      } else {
        setPairErrors((prev) => ({
          ...prev,
          [key]: result.error ?? "Merge failed.",
        }));
      }
    });
  }

  return (
    <>
      <button
        onClick={handleOpen}
        disabled={!hasDb}
        title={!hasDb ? "Database not connected" : "Find duplicate contacts with AI"}
        className="flex items-center gap-1.5 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-1.5 text-xs font-medium text-orange-300 transition-colors hover:bg-orange-500/20 disabled:cursor-not-allowed disabled:opacity-40"
      >
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
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
        Find duplicates
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 pt-16 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Find duplicate contacts"
            className="w-full max-w-2xl rounded-xl border border-neutral-800 bg-neutral-950 shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-neutral-100">
                  Find duplicate contacts
                </h2>
                <p className="mt-0.5 text-xs text-neutral-500">
                  AI scans all contacts for likely duplicates by name, email, and company.
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300"
                aria-label="Close"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="space-y-4 px-5 py-4">
              {!searched && !isPending && (
                <div className="flex justify-center py-6">
                  <button
                    onClick={handleScan}
                    className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
                  >
                    Scan for duplicates
                  </button>
                </div>
              )}

              {isPending && (
                <div className="flex flex-col items-center gap-2 py-10">
                  <span className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
                  <p className="text-xs text-neutral-500">AI is scanning contacts…</p>
                </div>
              )}

              {errorMsg && (
                <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  {errorMsg}
                </p>
              )}

              {searched && !isPending && !errorMsg && pairs.length === 0 && (
                <div className="py-10 text-center">
                  <p className="text-sm text-neutral-300">No duplicates found</p>
                  <p className="mt-1 text-xs text-neutral-600">
                    Your contacts list looks clean.
                  </p>
                  <button
                    onClick={handleScan}
                    disabled={isPending}
                    className="mt-4 text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-50"
                  >
                    Re-scan
                  </button>
                </div>
              )}

              {pairs.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-neutral-500">
                      {pairs.length} potential duplicate
                      {pairs.length !== 1 ? "s" : ""} found
                    </p>
                    <button
                      onClick={handleScan}
                      disabled={isPending}
                      className="text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-50"
                    >
                      Re-scan
                    </button>
                  </div>

                  {pairs.map((pair) => {
                    const key = pairKey(pair);
                    const isConfirming = confirmingKey === key;
                    const isMerging = mergingKey === key;
                    const err = pairErrors[key];

                    return (
                      <div
                        key={key}
                        className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-900 p-4"
                      >
                        <div className="flex items-start gap-3">
                          <div className="grid flex-1 grid-cols-2 gap-4">
                            {/* Primary */}
                            <div className="space-y-0.5">
                              <p className="text-[10px] font-medium uppercase tracking-wide text-emerald-600">
                                Keep (primary)
                              </p>
                              <p className="text-sm font-medium text-neutral-100">
                                {pair.primaryName}
                              </p>
                              {pair.primaryEmail && (
                                <p className="text-xs text-neutral-400">
                                  {pair.primaryEmail}
                                </p>
                              )}
                              {pair.primaryCompany && (
                                <p className="text-xs text-neutral-500">
                                  {pair.primaryCompany}
                                </p>
                              )}
                            </div>

                            {/* Secondary */}
                            <div className="space-y-0.5">
                              <p className="text-[10px] font-medium uppercase tracking-wide text-red-600">
                                Merge away
                              </p>
                              <p className="text-sm font-medium text-neutral-300">
                                {pair.secondaryName}
                              </p>
                              {pair.secondaryEmail && (
                                <p className="text-xs text-neutral-400">
                                  {pair.secondaryEmail}
                                </p>
                              )}
                              {pair.secondaryCompany && (
                                <p className="text-xs text-neutral-500">
                                  {pair.secondaryCompany}
                                </p>
                              )}
                            </div>
                          </div>

                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${CONFIDENCE_STYLES[pair.confidence]}`}
                          >
                            {pair.confidence}
                          </span>
                        </div>

                        <p className="text-xs italic text-neutral-500">
                          {pair.reason}
                        </p>

                        {err && <p className="text-xs text-red-400">{err}</p>}

                        <div className="flex items-center gap-2">
                          {!isConfirming ? (
                            <button
                              onClick={() => setConfirmingKey(key)}
                              disabled={isMerging}
                              className="rounded-md border border-red-500/20 bg-red-600/20 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-600/30 disabled:opacity-50"
                            >
                              Merge →
                            </button>
                          ) : (
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs text-neutral-400">
                                Merge &ldquo;{pair.secondaryName}&rdquo; into &ldquo;
                                {pair.primaryName}&rdquo;? Activities and deals will be
                                reassigned. This cannot be undone.
                              </span>
                              <button
                                onClick={() => handleMerge(pair)}
                                disabled={isMerging}
                                className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-500 disabled:opacity-50"
                              >
                                {isMerging ? "Merging…" : "Confirm merge"}
                              </button>
                              <button
                                onClick={() => setConfirmingKey(null)}
                                disabled={isMerging}
                                className="text-xs text-neutral-500 hover:text-neutral-300 disabled:opacity-50"
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
