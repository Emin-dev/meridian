"use client";

import { useEffect, useState, useTransition } from "react";
import { interpolate, contactToVars } from "@/lib/template";
import { markStepSent } from "./enrollment-actions";
import { useOverlayDismiss } from "@/hooks/use-overlay-dismiss";

interface Props {
  enrollmentId: number;
  sequenceId: number;
  contactId: number;
  contactName: string;
  contactEmail: string | null;
  contactCompany: string | null;
  contactOwner: string | null;
  stepSubjectTemplate: string;
  stepBodyTemplate: string;
  stepPosition: number;
  newStepPosition: number;
  totalSteps: number;
  defaultOwnerName: string;
}

export function SendStepButton(props: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="tap press flex items-center justify-center rounded-[var(--r-md)] bg-[var(--accent)] px-3 text-xs font-medium text-[var(--accent-ink)] hover:bg-[var(--accent-hover)]"
      >
        Send
      </button>
      {open && <SendStepModal {...props} onClose={() => setOpen(false)} />}
    </>
  );
}

function SendStepModal({
  enrollmentId,
  sequenceId,
  contactId,
  contactName,
  contactEmail,
  contactCompany,
  contactOwner,
  stepSubjectTemplate,
  stepBodyTemplate,
  stepPosition,
  newStepPosition,
  totalSteps,
  defaultOwnerName,
  onClose,
}: Props & { onClose: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState<"subject" | "body" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useOverlayDismiss<HTMLDivElement>(true, onClose);

  const vars = {
    ...contactToVars({ name: contactName, company: contactCompany, owner: contactOwner }),
    ownerName: contactOwner ?? (defaultOwnerName || "[Owner Name]"),
  };

  const subject = interpolate(stepSubjectTemplate, vars);
  const body = interpolate(stepBodyTemplate, vars);

  // Reset the "Copied!" label after 2s, with cleanup so the timer can't fire
  // on an unmounted component when the modal closes mid-countdown.
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(null), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  function copyToClipboard(text: string, field: "subject" | "body") {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(field);
    });
  }

  function handleMarkSent() {
    setError(null);
    startTransition(async () => {
      const result = await markStepSent(
        enrollmentId,
        sequenceId,
        contactId,
        subject,
        body,
        newStepPosition,
        totalSteps,
      );
      if (result?.error) {
        setError(result.error);
        return;
      }
      onClose();
    });
  }

  const mailtoHref = contactEmail
    ? `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Sequence step ${stepPosition} of ${totalSteps}`}
        className="flex w-full max-w-lg flex-col rounded-t-[var(--r-2xl)] border border-[var(--line-1)] bg-[var(--surface-1)] shadow-[var(--shadow-3)] max-h-[90dvh] pb-[env(safe-area-inset-bottom)] sm:rounded-[var(--r-xl)] sm:pb-0"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--line-1)] px-4 py-4">
          <div>
            <h3 className="text-callout font-semibold text-[var(--ink-1)]">
              Step {stepPosition} of {totalSteps}
            </h3>
            <p className="mt-0.5 text-footnote text-[var(--ink-3)]">
              {contactName}
              {contactEmail ? ` · ${contactEmail}` : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="tap flex items-center justify-center rounded-full text-[var(--ink-3)] transition-colors hover:text-[var(--ink-1)]"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-footnote font-medium text-[var(--ink-3)]">Subject</p>
              <button
                onClick={() => copyToClipboard(subject, "subject")}
                className="tap flex items-center justify-center px-3 text-footnote text-[var(--ink-3)] transition-colors hover:text-[var(--ink-1)]"
              >
                {copied === "subject" ? "Copied!" : "Copy"}
              </button>
            </div>
            <div className="rounded-[var(--r-md)] border border-[var(--line-1)] bg-[var(--surface-2)] px-3 py-2.5 text-body text-[var(--ink-1)] break-words">
              {subject}
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-footnote font-medium text-[var(--ink-3)]">Body</p>
              <button
                onClick={() => copyToClipboard(body, "body")}
                className="tap flex items-center justify-center px-3 text-footnote text-[var(--ink-3)] transition-colors hover:text-[var(--ink-1)]"
              >
                {copied === "body" ? "Copied!" : "Copy"}
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto rounded-[var(--r-md)] border border-[var(--line-1)] bg-[var(--surface-2)] px-3 py-2.5 text-body leading-relaxed whitespace-pre-wrap text-[var(--ink-2)] break-words">
              {body}
            </div>
          </div>
        </div>

        {/* Note */}
        <div className="shrink-0 border-t border-[var(--line-1)] px-4 py-3">
          <p className="text-footnote text-[var(--ink-3)]">
            Meridian tracks sequence steps but does not send email directly. Use the link below to open your email client, then log the step once sent.
          </p>
          {error && (
            <p className="mt-2 text-footnote text-[var(--bad)]">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line-1)] px-4 py-3">
          <div>
            {mailtoHref ? (
              <a
                href={mailtoHref}
                target="_blank"
                rel="noreferrer"
                className="tap inline-flex items-center gap-1.5 rounded-[var(--r-md)] bg-[var(--accent)] px-3 text-xs font-medium text-[var(--accent-ink)] transition-colors hover:bg-[var(--accent-hover)]"
              >
                Open in email client ↗
              </a>
            ) : (
              <span className="text-footnote text-[var(--ink-3)]">No email address on file</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={isPending}
              className="tap inline-flex items-center justify-center rounded-[var(--r-md)] px-3 text-xs text-[var(--ink-2)] transition-colors hover:text-[var(--ink-1)] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleMarkSent}
              disabled={isPending}
              className="tap inline-flex items-center justify-center rounded-[var(--r-md)] bg-[var(--ok)] px-3 text-xs font-medium text-[var(--bg)] transition-colors hover:opacity-90 disabled:opacity-50"
            >
              {isPending ? "Logging…" : "Log as Sent"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
