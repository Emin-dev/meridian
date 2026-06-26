"use client";

import { useRef, useState, useTransition } from "react";
import { bulkImportContacts } from "./actions";
import type { ImportSkippedRow } from "./actions";
import { parseCsv, type ParsedRow } from "@/lib/csv";
import { useToast } from "@/components/toaster";

interface Props {
  hasDb: boolean;
}

const PREVIEW_LIMIT = 8;

type ModalMode = "input" | "results";

export default function CsvImportModal({ hasDb }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [csvText, setCsvText] = useState("");
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState<string | undefined>();
  const [parseSkipped, setParseSkipped] = useState<ImportSkippedRow[]>([]);

  // Results state
  const [mode, setMode] = useState<ModalMode>("input");
  const [importCount, setImportCount] = useState(0);
  const [allSkipped, setAllSkipped] = useState<ImportSkippedRow[]>([]);

  function handleTextChange(text: string) {
    setCsvText(text);
    if (!text.trim()) {
      setParsed([]);
      setParseError(undefined);
      setParseSkipped([]);
      return;
    }
    const result = parseCsv(text);
    setParsed(result.rows);
    setParseError(result.error);
    setParseSkipped(result.skipped);
  }

  function handleOpen() {
    setCsvText("");
    setParsed([]);
    setParseError(undefined);
    setParseSkipped([]);
    setMode("input");
    setImportCount(0);
    setAllSkipped([]);
    // Never let two modals stack/overlap: close any other open dialog first.
    document
      .querySelectorAll("dialog[open]")
      .forEach((d) => (d as HTMLDialogElement).close());
    dialogRef.current?.showModal();
  }

  function handleClose() {
    dialogRef.current?.close();
  }

  function handleImport() {
    if (parsed.length === 0) return;
    startTransition(async () => {
      try {
        const result = await bulkImportContacts(parsed);
        if (result.error) {
          toast(result.error, "error");
          dialogRef.current?.close();
          return;
        }
        const serverSkipped = Array.isArray(result.skipped) ? result.skipped : [];
        const combined = [...parseSkipped, ...serverSkipped].sort((a, b) => a.row - b.row);
        setImportCount(result.count);
        setAllSkipped(combined);
        setMode("results");
      } catch {
        toast("Import failed — please try again.", "error");
        dialogRef.current?.close();
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="rounded-lg border border-[var(--line-1)] bg-[var(--surface-2)] px-4 py-2 text-sm font-medium text-[var(--ink-2)] transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--ink-1)]"
      >
        Import CSV
      </button>

      <dialog
        ref={dialogRef}
        onClick={(e) => {
          if (e.target === dialogRef.current && !isPending)
            dialogRef.current?.close();
        }}
        className="m-0 inset-x-0 bottom-0 top-auto w-full max-w-none rounded-t-[var(--r-2xl)] max-h-[90dvh] overflow-hidden flex flex-col border border-[var(--line-1)] bg-[var(--surface-1)] p-0 text-[var(--ink-1)] shadow-2xl backdrop:bg-black/60 sm:m-auto sm:inset-0 sm:max-w-2xl sm:w-full sm:rounded-xl"
      >
        {mode === "results" ? (
          <>
            {/* Results header */}
            <div className="flex items-center justify-between border-b border-[var(--line-1)] px-6 py-4 shrink-0">
              <h2 className="text-base font-semibold">Import Complete</h2>
              <button
                type="button"
                onClick={handleClose}
                className="tap flex items-center justify-center rounded-lg text-[var(--ink-2)] hover:bg-[var(--surface-2)] hover:text-[var(--ink-1)] transition-colors"
                aria-label="Close"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 px-6 py-5">
              {/* Summary counts */}
              <div className="flex gap-4">
                <div className="flex-1 rounded-lg border border-[var(--ok-tint)] bg-[var(--ok-tint)] px-4 py-3 text-center">
                  <p className="text-2xl font-bold text-[var(--ok)]">{importCount}</p>
                  <p className="mt-0.5 text-xs text-[var(--ok)]">imported</p>
                </div>
                <div className="flex-1 rounded-lg border border-[var(--line-1)] bg-[var(--surface-2)] px-4 py-3 text-center">
                  <p className="text-2xl font-bold text-[var(--ink-1)]">{allSkipped.length}</p>
                  <p className="mt-0.5 text-xs text-[var(--ink-3)]">skipped</p>
                </div>
              </div>

              {/* Skipped rows list */}
              {allSkipped.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium text-[var(--ink-2)]">Skipped rows</p>
                  <div className="max-h-56 overflow-x-auto overflow-y-auto rounded-lg border border-[var(--line-1)]">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-[var(--surface-1)]">
                        <tr className="border-b border-[var(--line-1)] bg-[var(--surface-2)]">
                          <th className="w-16 px-3 py-2 text-left font-medium uppercase tracking-wide text-[var(--ink-3)]">Row</th>
                          <th className="px-3 py-2 text-left font-medium uppercase tracking-wide text-[var(--ink-3)]">Name</th>
                          <th className="px-3 py-2 text-left font-medium uppercase tracking-wide text-[var(--ink-3)]">Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allSkipped.map((s, i) => (
                          <tr key={i} className="border-b border-[var(--line-1)] last:border-0">
                            <td className="px-3 py-2 tabular-nums text-[var(--ink-3)]">{s.row}</td>
                            <td className="px-3 py-2 font-medium text-[var(--ink-1)]">{s.name}</td>
                            <td className="px-3 py-2 text-[var(--warn)]">{s.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {allSkipped.length === 0 && (
                <p className="text-center text-xs text-[var(--ink-3)]">All rows imported successfully — no rows were skipped.</p>
              )}
            </div>

            <div className="flex justify-end border-t border-[var(--line-1)] px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] shrink-0">
              <button
                type="button"
                onClick={handleClose}
                className="tap flex items-center justify-center rounded-lg bg-[--accent] px-4 text-sm font-medium text-[--accent-ink] transition-colors hover:bg-[--accent-hover]"
              >
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Input header */}
            <div className="flex items-center justify-between border-b border-[var(--line-1)] px-6 py-4 shrink-0">
              <div>
                <h2 className="text-base font-semibold">Import Contacts from CSV</h2>
                <p className="mt-0.5 text-xs text-[var(--ink-3)]">
                  Columns: <code className="rounded bg-[var(--surface-2)] px-1">name</code>,{" "}
                  <code className="rounded bg-[var(--surface-2)] px-1">email</code>,{" "}
                  <code className="rounded bg-[var(--surface-2)] px-1">phone</code>,{" "}
                  <code className="rounded bg-[var(--surface-2)] px-1">company</code>
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="tap flex items-center justify-center rounded-lg text-[var(--ink-2)] hover:bg-[var(--surface-2)] hover:text-[var(--ink-1)] transition-colors"
                aria-label="Close"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 px-6 py-5">
              {!hasDb ? (
                <div className="space-y-2 py-6 text-center">
                  <p className="text-sm text-[var(--ink-2)]">Database not connected.</p>
                  <p className="text-xs text-[var(--ink-3)]">
                    Set <code className="rounded bg-[var(--surface-2)] px-1 py-0.5">DATABASE_URL</code> to
                    import contacts.
                  </p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--ink-2)]">
                      Paste CSV text
                    </label>
                    <textarea
                      rows={6}
                      value={csvText}
                      onChange={(e) => handleTextChange(e.target.value)}
                      placeholder={"name,email,phone,company\nJane Smith,jane@example.com,+1 555 0001,Acme Corp"}
                      className="w-full resize-y rounded-lg border border-[var(--line-1)] bg-[var(--surface-2)] px-3 py-2 font-mono text-xs text-[var(--ink-1)] placeholder-[var(--ink-3)] focus:border-[--accent] focus:outline-none"
                    />
                  </div>

                  {parseError && (
                    <p className="text-xs text-[var(--bad)]">{parseError}</p>
                  )}

                  {parseSkipped.length > 0 && (
                    <p className="text-xs text-[var(--warn)]">
                      {parseSkipped.length} row{parseSkipped.length !== 1 ? "s" : ""} will be skipped (missing name).
                    </p>
                  )}

                  {parsed.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-medium text-[var(--ink-2)]">
                        Preview — {parsed.length} row{parsed.length !== 1 ? "s" : ""}
                        {parsed.length > PREVIEW_LIMIT && ` (showing first ${PREVIEW_LIMIT})`}
                      </p>
                      <div className="overflow-x-auto rounded-lg border border-[var(--line-1)]">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-[var(--line-1)] bg-[var(--surface-2)]">
                              {["Name", "Email", "Phone", "Company"].map((h) => (
                                <th
                                  key={h}
                                  className="px-3 py-2 text-left font-medium uppercase tracking-wide text-[var(--ink-3)]"
                                >
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {parsed.slice(0, PREVIEW_LIMIT).map((row, i) => (
                              <tr
                                key={i}
                                className="border-b border-[var(--line-1)] last:border-0"
                              >
                                <td className="px-3 py-2 font-medium text-[var(--ink-1)]">{row.name || "—"}</td>
                                <td className="px-3 py-2 text-[var(--ink-2)]">{row.email || "—"}</td>
                                <td className="px-3 py-2 text-[var(--ink-2)]">{row.phone || "—"}</td>
                                <td className="px-3 py-2 text-[var(--ink-2)]">{row.company || "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 border-t border-[var(--line-1)] px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] shrink-0">
              <button
                type="button"
                onClick={handleClose}
                className="tap flex items-center justify-center rounded-lg px-4 text-sm text-[var(--ink-2)] hover:bg-[var(--surface-2)] hover:text-[var(--ink-1)]"
              >
                Cancel
              </button>
              {hasDb && (
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={parsed.length === 0 || isPending}
                  className="tap flex items-center justify-center rounded-lg bg-[--accent] px-4 text-sm font-medium text-[--accent-ink] transition-colors hover:bg-[--accent-hover] disabled:opacity-50"
                >
                  {isPending
                    ? "Importing…"
                    : parsed.length > 0
                      ? `Import ${parsed.length} contact${parsed.length !== 1 ? "s" : ""}`
                      : "Import"}
                </button>
              )}
            </div>
          </>
        )}
      </dialog>
    </>
  );
}
