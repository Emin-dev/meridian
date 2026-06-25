"use client";

import { useState, useTransition } from "react";
import { interpolate, contactToVars } from "@/lib/template";
import { markStepSent } from "./enrollment-actions";

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
        className="tap flex items-center justify-center rounded-[--r-md] bg-[--accent] px-3 text-xs font-medium text-[--accent-ink] transition-colors hover:bg-[--accent-hover] active:scale-[0.98]"
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

  const vars = {
    ...contactToVars({ name: contactName, company: contactCompany, owner: contactOwner }),
    ownerName: contactOwner ?? (defaultOwnerName || "[Owner Name]"),
  };

  const subject = interpolate(stepSubjectTemplate, vars);
  const body = interpolate(stepBodyTemplate, vars);

  function copyToClipboard(text: string, field: "subject" | "body") {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(field);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  function handleMarkSent() {
    startTransition(async () => {
      await markStepSent(
        enrollmentId,
        sequenceId,
        contactId,
        subject,
        body,
        newStepPosition,
        totalSteps,
      );
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
      <div className="flex w-full max-w-lg flex-col rounded-t-[--r-2xl] border border-[--line-1] bg-[--surface-1] shadow-[--shadow-3] max-h-[90dvh] pb-[env(safe-area-inset-bottom)] sm:rounded-[--r-xl] sm:pb-0">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[--line-1] px-4 py-4">
          <div>
            <h3 className="text-callout font-semibold text-[--ink-1]">
              Step {stepPosition} of {totalSteps}
            </h3>
            <p className="mt-0.5 text-footnote text-[--ink-3]">
              {contactName}
              {contactEmail ? ` · ${contactEmail}` : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="tap flex items-center justify-center rounded-full text-[--ink-3] transition-colors hover:text-[--ink-1]"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-footnote font-medium text-[--ink-3]">Subject</p>
              <button
                onClick={() => copyToClipboard(subject, "subject")}
                className="tap flex items-center justify-center px-3 text-footnote text-[--ink-3] transition-colors hover:text-[--ink-1]"
              >
                {copied === "subject" ? "Copied!" : "Copy"}
              </button>
            </div>
            <div className="rounded-[--r-md] border border-[--line-1] bg-[--surface-2] px-3 py-2.5 text-body text-[--ink-1] break-words">
              {subject}
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-footnote font-medium text-[--ink-3]">Body</p>
              <button
                onClick={() => copyToClipboard(body, "body")}
                className="tap flex items-center justify-center px-3 text-footnote text-[--ink-3] transition-colors hover:text-[--ink-1]"
              >
                {copied === "body" ? "Copied!" : "Copy"}
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto rounded-[--r-md] border border-[--line-1] bg-[--surface-2] px-3 py-2.5 text-body leading-relaxed whitespace-pre-wrap text-[--ink-2] break-words">
              {body}
            </div>
          </div>
        </div>

        {/* Note */}
        <div className="shrink-0 border-t border-[--line-1] px-4 py-3">
          <p className="text-footnote text-[--ink-3]">
            Meridian tracks sequence steps but does not send email directly. Use the link below to open your email client, then log the step once sent.
          </p>
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-between border-t border-[--line-1] px-4 py-3">
          <div>
            {mailtoHref ? (
              <a
                href={mailtoHref}
                target="_blank"
                rel="noreferrer"
                className="tap inline-flex items-center gap-1.5 rounded-[--r-md] bg-[--accent] px-3 text-xs font-medium text-[--accent-ink] transition-colors hover:bg-[--accent-hover]"
              >
                Open in email client ↗
              </a>
            ) : (
              <span className="text-footnote text-[--ink-3]">No email address on file</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={isPending}
              className="tap inline-flex items-center justify-center rounded-[--r-md] px-3 text-xs text-[--ink-2] transition-colors hover:text-[--ink-1] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleMarkSent}
              disabled={isPending}
              className="tap inline-flex items-center justify-center rounded-[--r-md] bg-emerald-600 px-3 text-xs font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
            >
              {isPending ? "Logging…" : "Log as Sent"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
