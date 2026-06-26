"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  enrichContact,
  applyContactEnrichment,
  type EnrichState,
  type ApplyEnrichmentState,
} from "../actions";
import AiPanelStatus from "@/components/ai-panel-status";

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
      try {
        const r = await enrichContact(contactId);
        setResult(r);
        if (r.title !== undefined || r.company !== undefined || r.notes !== undefined) {
          setFields({
            title: r.title ?? "",
            company: r.company ?? "",
            notes: r.notes ?? "",
          });
        }
      } catch {
        setResult((prev) => ({ ...prev, error: "Something went wrong — please try again." }));
      }
    });
  }

  function handleSave() {
    setSaveState({});
    startSaveTransition(async () => {
      const r = await applyContactEnrichment(contactId, fields);
      setSaveState(r);
      if (r.success) {
        router.refresh();
      }
    });
  }

  const inputCls =
    "tap w-full rounded-lg border border-[var(--line-1)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--ink-1)] placeholder-[var(--ink-3)] focus:border-[var(--accent)] focus:outline-none";
  const textareaCls = `${inputCls} resize-none leading-relaxed`;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="min-w-0 text-sm font-medium text-[var(--ink-2)]">
          AI contact enrichment
        </h3>
        <button
          type="button"
          onClick={handleEnrich}
          disabled={isPending}
          className="tap inline-flex shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] px-3 text-xs font-medium text-[var(--accent-ink)] transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50"
        >
          {isPending ? "Enriching…" : hasResult ? "Re-enrich" : "Enrich with AI"}
        </button>
      </div>

      <AiPanelStatus
        noDb={result.noDb}
        noKey={result.noKey}
        error={result.error}
        keyHint="enable AI contact enrichment."
        hasResult={hasResult}
        isPending={isPending}
        emptyHint={
          <p className="text-xs text-[var(--ink-3)]">
            Click &ldquo;Enrich with AI&rdquo; to infer missing fields (title,
            company, notes) from this contact&apos;s name, email, and activity.
          </p>
        }
      />

      {hasResult && (
        <div className="space-y-3">
          <p className="text-xs text-[var(--ink-3)]">
            Review the AI suggestions below, edit if needed, then apply.
          </p>

          <div className="space-y-2">
            <div>
              <label className="mb-1 block text-xs text-[var(--ink-2)]">
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
              <label className="mb-1 block text-xs text-[var(--ink-2)]">
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
              <label className="mb-1 block text-xs text-[var(--ink-2)]">
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
            <p className="text-xs text-[var(--ink-2)]">
              Database not connected — cannot save changes.
            </p>
          )}
          {saveState.error && (
            <p className="text-xs text-[var(--bad)]">{saveState.error}</p>
          )}
          {saveState.success && (
            <p className="text-xs text-[var(--ok)]">
              Contact updated successfully.
            </p>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="tap inline-flex items-center justify-center rounded-lg bg-[var(--accent)] px-3 text-xs font-medium text-[var(--accent-ink)] transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50"
          >
            {isSaving ? "Applying…" : "Apply suggestions"}
          </button>
        </div>
      )}
    </div>
  );
}
