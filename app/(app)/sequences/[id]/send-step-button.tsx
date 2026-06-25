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
        className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-indigo-500"
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-xl border border-neutral-700 bg-neutral-900 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-neutral-100">
              Step {stepPosition} of {totalSteps}
            </h3>
            <p className="mt-0.5 text-xs text-neutral-500">
              {contactName}
              {contactEmail ? ` · ${contactEmail}` : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-500 transition-colors hover:text-neutral-300"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-5 py-4">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <p className="text-xs font-medium text-neutral-500">Subject</p>
              <button
                onClick={() => copyToClipboard(subject, "subject")}
                className="text-xs text-neutral-500 transition-colors hover:text-neutral-300"
              >
                {copied === "subject" ? "Copied!" : "Copy"}
              </button>
            </div>
            <div className="rounded-lg border border-neutral-800 bg-neutral-800/50 px-3 py-2.5 text-sm text-neutral-200">
              {subject}
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <p className="text-xs font-medium text-neutral-500">Body</p>
              <button
                onClick={() => copyToClipboard(body, "body")}
                className="text-xs text-neutral-500 transition-colors hover:text-neutral-300"
              >
                {copied === "body" ? "Copied!" : "Copy"}
              </button>
            </div>
            <div className="max-h-52 overflow-y-auto rounded-lg border border-neutral-800 bg-neutral-800/50 px-3 py-2.5 text-sm leading-relaxed whitespace-pre-wrap text-neutral-400">
              {body}
            </div>
          </div>
        </div>

        {/* Note */}
        <div className="border-t border-neutral-800 px-5 py-3">
          <p className="text-xs text-neutral-500">
            Meridian tracks sequence steps but does not send email directly. Use the link below to open your email client, then log the step once sent.
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-neutral-800 px-5 py-4">
          <div>
            {mailtoHref ? (
              <a
                href={mailtoHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-500"
              >
                Open in email client ↗
              </a>
            ) : (
              <span className="text-xs text-neutral-600">No email address on file</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={isPending}
              className="text-xs text-neutral-400 transition-colors hover:text-neutral-200 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleMarkSent}
              disabled={isPending}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
            >
              {isPending ? "Logging…" : "Log as Sent"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
