"use client";

import { useEffect, useState, useTransition } from "react";
import { draftOutreachEmail, type DraftEmailState } from "../actions";
import AiPanelStatus from "@/components/ai-panel-status";

interface Props {
  contactId: number;
  contactEmail?: string | null;
}

export default function DraftEmailPanel({ contactId, contactEmail }: Props) {
  const [result, setResult] = useState<DraftEmailState>({});
  const [draftText, setDraftText] = useState("");
  const [copied, setCopied] = useState(false);
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

  // Reset the "Copied!" label after 2s, with cleanup so the timer can't fire
  // on an unmounted component when the user navigates away mid-countdown.
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  function handleCopy() {
    if (!draftText) return;
    navigator.clipboard.writeText(draftText).then(() => {
      setCopied(true);
    });
  }

  const mailtoHref = contactEmail
    ? `mailto:${contactEmail}?body=${encodeURIComponent(draftText)}`
    : null;

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
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 text-xs text-[var(--ink-3)]">
              Edit the draft below before sending.
            </p>
            <button
              type="button"
              onClick={handleCopy}
              className="tap inline-flex shrink-0 items-center justify-center rounded-md px-2 text-caption text-[var(--ink-3)] hover:text-[var(--ink-1)] transition-colors"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <textarea
            rows={10}
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            className={textareaCls}
          />
          <div className="pt-0.5">
            {mailtoHref ? (
              <a
                href={mailtoHref}
                target="_blank"
                rel="noreferrer"
                className="tap inline-flex items-center gap-1.5 rounded-lg border border-[var(--line-1)] bg-[var(--surface-2)] px-3 text-xs font-medium text-[var(--ink-1)] transition-colors hover:border-[var(--line-2)] hover:bg-[var(--surface-3)]"
              >
                Open in email client ↗
              </a>
            ) : (
              <span className="text-caption text-[var(--ink-3)]">No email address on file</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
