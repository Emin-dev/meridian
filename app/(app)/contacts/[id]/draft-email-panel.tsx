"use client";

import { useState, useTransition } from "react";
import { draftOutreachEmail, type DraftEmailState } from "../actions";
import AiPanelStatus from "@/components/ai-panel-status";

interface Props {
  contactId: number;
}

export default function DraftEmailPanel({ contactId }: Props) {
  const [result, setResult] = useState<DraftEmailState>({});
  const [draftText, setDraftText] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleDraft() {
    setResult((prev) => ({ ...prev, error: undefined }));
    startTransition(async () => {
      try {
        const r = await draftOutreachEmail(contactId);
        setResult(r);
        if (r.draft) setDraftText(r.draft);
      } catch {
        setResult((prev) => ({ ...prev, error: "Something went wrong — please try again." }));
      }
    });
  }

  const textareaCls =
    "w-full rounded-lg border border-[var(--line-1)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--ink-1)] placeholder-[var(--ink-3)] focus:border-[var(--accent)] focus:outline-none resize-none leading-relaxed";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="min-w-0 text-sm font-medium text-[var(--ink-1)]">AI outreach email</h3>
        <button
          type="button"
          onClick={handleDraft}
          disabled={isPending}
          className="tap inline-flex shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] px-3 text-xs font-medium text-[var(--accent-ink)] transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50"
        >
          {isPending ? "Drafting…" : draftText ? "Re-draft" : "Draft email"}
        </button>
      </div>

      <AiPanelStatus
        noDb={result.noDb}
        noKey={result.noKey}
        error={result.error}
        keyHint="enable AI email drafting."
        hasResult={Boolean(draftText)}
        isPending={isPending}
        emptyHint={
          <p className="text-xs text-[var(--ink-3)]">
            Click &ldquo;Draft email&rdquo; to generate a personalized AI outreach email using this contact&apos;s details.
          </p>
        }
      />

      {draftText && (
        <div className="space-y-1.5">
          <p className="text-xs text-[var(--ink-3)]">
            Edit the draft below before sending.
          </p>
          <textarea
            rows={10}
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            className={textareaCls}
          />
        </div>
      )}
    </div>
  );
}
