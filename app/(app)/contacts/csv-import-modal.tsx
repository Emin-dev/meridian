"use client";

import { useRef, useState, useTransition } from "react";
import { bulkImportContacts } from "./actions";
import { useToast } from "@/components/toaster";

interface ParsedRow {
  name: string;
  email: string;
  phone: string;
  company: string;
}

function parseCsv(text: string): { rows: ParsedRow[]; error?: string } {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return { rows: [], error: "Paste at least a header row and one data row." };

  const parseFields = (line: string): string[] => {
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if ((ch === "," || ch === "\t" || ch === ";") && !inQuotes) {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    fields.push(current.trim());
    return fields;
  };

  const headers = parseFields(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, ""));
  const colIndex = (candidates: string[]) =>
    candidates.reduce((found, c) => (found !== -1 ? found : headers.indexOf(c)), -1);

  const nameIdx = colIndex(["name", "fullname", "full_name", "contact"]);
  const emailIdx = colIndex(["email", "emailaddress", "e-mail"]);
  const phoneIdx = colIndex(["phone", "phonenumber", "phone_number", "mobile", "tel"]);
  const companyIdx = colIndex(["company", "organization", "org", "account"]);

  if (nameIdx === -1) return { rows: [], error: 'Could not find a "name" column in the header row.' };

  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = parseFields(lines[i]);
    const name = nameIdx !== -1 ? (fields[nameIdx] ?? "") : "";
    if (!name) continue;
    rows.push({
      name,
      email: emailIdx !== -1 ? (fields[emailIdx] ?? "") : "",
      phone: phoneIdx !== -1 ? (fields[phoneIdx] ?? "") : "",
      company: companyIdx !== -1 ? (fields[companyIdx] ?? "") : "",
    });
  }

  if (rows.length === 0) return { rows: [], error: "No valid data rows found." };
  return { rows };
}

interface Props {
  hasDb: boolean;
}

const PREVIEW_LIMIT = 8;

export default function CsvImportModal({ hasDb }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [csvText, setCsvText] = useState("");
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState<string | undefined>();

  function handleTextChange(text: string) {
    setCsvText(text);
    if (!text.trim()) {
      setParsed([]);
      setParseError(undefined);
      return;
    }
    const result = parseCsv(text);
    setParsed(result.rows);
    setParseError(result.error);
  }

  function handleOpen() {
    setCsvText("");
    setParsed([]);
    setParseError(undefined);
    dialogRef.current?.showModal();
  }

  function handleClose() {
    dialogRef.current?.close();
  }

  function handleImport() {
    if (parsed.length === 0) return;
    startTransition(async () => {
      const result = await bulkImportContacts(parsed);
      dialogRef.current?.close();
      if (result.error) {
        toast(result.error, "error");
      } else {
        toast(`Imported ${result.count} contact${result.count !== 1 ? "s" : ""}`, "success");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-300 transition-colors hover:bg-neutral-700 hover:text-neutral-100"
      >
        Import CSV
      </button>

      <dialog
        ref={dialogRef}
        className="w-full max-w-2xl rounded-xl border border-neutral-800 bg-neutral-900 p-0 text-neutral-100 shadow-2xl backdrop:bg-black/60"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold">Import Contacts from CSV</h2>
            <p className="mt-0.5 text-xs text-neutral-500">
              Columns: <code className="rounded bg-neutral-800 px-1">name</code>,{" "}
              <code className="rounded bg-neutral-800 px-1">email</code>,{" "}
              <code className="rounded bg-neutral-800 px-1">phone</code>,{" "}
              <code className="rounded bg-neutral-800 px-1">company</code>
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md p-1 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
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
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          {!hasDb ? (
            <div className="space-y-2 py-6 text-center">
              <p className="text-sm text-neutral-300">Database not connected.</p>
              <p className="text-xs text-neutral-500">
                Set <code className="rounded bg-neutral-800 px-1 py-0.5">DATABASE_URL</code> to
                import contacts.
              </p>
            </div>
          ) : (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-400">
                  Paste CSV text
                </label>
                <textarea
                  rows={6}
                  value={csvText}
                  onChange={(e) => handleTextChange(e.target.value)}
                  placeholder={"name,email,phone,company\nJane Smith,jane@example.com,+1 555 0001,Acme Corp"}
                  className="w-full resize-y rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 font-mono text-xs text-neutral-100 placeholder-neutral-600 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {parseError && (
                <p className="text-xs text-red-400">{parseError}</p>
              )}

              {parsed.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium text-neutral-400">
                    Preview — {parsed.length} row{parsed.length !== 1 ? "s" : ""}
                    {parsed.length > PREVIEW_LIMIT && ` (showing first ${PREVIEW_LIMIT})`}
                  </p>
                  <div className="overflow-x-auto rounded-lg border border-neutral-800">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-neutral-800 bg-neutral-800/50">
                          {["Name", "Email", "Phone", "Company"].map((h) => (
                            <th
                              key={h}
                              className="px-3 py-2 text-left font-medium uppercase tracking-wide text-neutral-500"
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
                            className="border-b border-neutral-800 last:border-0"
                          >
                            <td className="px-3 py-2 font-medium text-neutral-200">{row.name || "—"}</td>
                            <td className="px-3 py-2 text-neutral-400">{row.email || "—"}</td>
                            <td className="px-3 py-2 text-neutral-400">{row.phone || "—"}</td>
                            <td className="px-3 py-2 text-neutral-400">{row.company || "—"}</td>
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
        <div className="flex justify-end gap-3 border-t border-neutral-800 px-6 py-4">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg px-4 py-2 text-sm text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
          >
            Cancel
          </button>
          {hasDb && (
            <button
              type="button"
              onClick={handleImport}
              disabled={parsed.length === 0 || isPending}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
            >
              {isPending
                ? "Importing…"
                : parsed.length > 0
                  ? `Import ${parsed.length} contact${parsed.length !== 1 ? "s" : ""}`
                  : "Import"}
            </button>
          )}
        </div>
      </dialog>
    </>
  );
}
