"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  enrichContact,
  applyContactEnrichment,
  type EnrichState,
  type ApplyEnrichmentState,
} from "../actions";

interface Props {
  contactId: number;
}

export default function EnrichContactPanel({ contactId }: Props) {
  const router = useRouter();
  const [result, setResult] = useState<EnrichState>({});
  const [fields, setFields] = useState({ title: "", company: "", notes: "" });
  const [saveState, setSaveState] = useState<ApplyEnrichmentState>({});
  const [isPending, startTransition] = useTransition();
  const [isSaving, startSaveTransition] = useTransition();

  const hasResult =
    result.title !== undefined ||
    result.company !== undefined ||
    result.notes !== undefined;

  function handleEnrich() {
    setSaveState({});
    startTransition(async () => {
      const r = await enrichContact(contactId);
      setResult(r);
      if (r.title !== undefined || r.company !== undefined || r.notes !== undefined) {
        setFields({
          title: r.title ?? "",
          company: r.company ?? "",
          notes: r.notes ?? "",
        });
      }
    });
  }

  function handleSave() {
    startSaveTransition(async () => {
      const r = await applyContactEnrichment(contactId, fields);
      setSaveState(r);
      if (r.success) {
        router.refresh();
      }
    });
  }

  const inputCls =
    "w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-indigo-500 focus:outline-none";
  const textareaCls = `${inputCls} resize-none leading-relaxed`;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-neutral-300">
          AI contact enrichment
        </h3>
        <button
          type="button"
          onClick={handleEnrich}
          disabled={isPending}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
        >
          {isPending ? "Enriching…" : hasResult ? "Re-enrich" : "Enrich with AI"}
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
          <code className="rounded bg-neutral-800 px-1 py-0.5">
            DEEPSEEK_API_KEY
          </code>{" "}
          in your environment to enable AI contact enrichment.
        </p>
      )}

      {result.error && (
        <p className="text-xs text-red-400">{result.error}</p>
      )}

      {hasResult ? (
        <div className="space-y-3">
          <p className="text-xs text-neutral-500">
            Review the AI suggestions below, edit if needed, then apply.
          </p>

          <div className="space-y-2">
            <div>
              <label className="mb-1 block text-xs text-neutral-400">
                Title
              </label>
              <input
                type="text"
                value={fields.title}
                onChange={(e) =>
                  setFields((f) => ({ ...f, title: e.target.value }))
                }
                placeholder="Job title"
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-neutral-400">
                Company
              </label>
              <input
                type="text"
                value={fields.company}
                onChange={(e) =>
                  setFields((f) => ({ ...f, company: e.target.value }))
                }
                placeholder="Company name"
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-neutral-400">
                Notes context
              </label>
              <textarea
                rows={4}
                value={fields.notes}
                onChange={(e) =>
                  setFields((f) => ({ ...f, notes: e.target.value }))
                }
                placeholder="Notes"
                className={textareaCls}
              />
            </div>
          </div>

          {saveState.noDb && (
            <p className="text-xs text-neutral-400">
              Database not connected — cannot save changes.
            </p>
          )}
          {saveState.error && (
            <p className="text-xs text-red-400">{saveState.error}</p>
          )}
          {saveState.success && (
            <p className="text-xs text-emerald-400">
              Contact updated successfully.
            </p>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
          >
            {isSaving ? "Applying…" : "Apply suggestions"}
          </button>
        </div>
      ) : (
        !result.noDb &&
        !result.noKey &&
        !result.error &&
        !isPending && (
          <p className="text-xs text-neutral-500">
            Click &ldquo;Enrich with AI&rdquo; to infer missing fields (title,
            company, notes) from this contact&apos;s name, email, and activity.
          </p>
        )
      )}
    </div>
  );
}
