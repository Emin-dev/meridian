"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { SendStepButton } from "./[id]/send-step-button";
import { sendAllDueSteps } from "./due-actions";

export interface DueEnrollment {
  enrollmentId: number;
  sequenceId: number;
  sequenceName: string;
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
  daysOverdue: number;
}

interface Props {
  dueEnrollments: DueEnrollment[];
  defaultOwnerName: string;
}

export function DueStepsSection({ dueEnrollments, defaultOwnerName }: Props) {
  const [isPending, startTransition] = useTransition();
  const [batchError, setBatchError] = useState<string | null>(null);
  const [batchDone, setBatchDone] = useState<number | null>(null);
  const [batchRemaining, setBatchRemaining] = useState(0);

  if (dueEnrollments.length === 0) return null;

  function handleSendAll() {
    setBatchError(null);
    setBatchDone(null);
    const ids = dueEnrollments.map((e) => e.enrollmentId);
    startTransition(async () => {
      try {
        const result = await sendAllDueSteps(ids);
        if (result.error) {
          setBatchError(result.error);
        } else {
          setBatchDone(result.sent);
          setBatchRemaining(result.remaining);
        }
      } catch {
        setBatchError("Couldn't log the due steps. Please try again.");
      }
    });
  }

  return (
    <div className="card relative overflow-hidden">
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1 bg-[var(--warn)]/40"
      />
      {/* Responsive header */}
      <div className="flex flex-col gap-2 border-b border-[var(--line-1)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <p className="text-caption font-medium uppercase tracking-wide text-[var(--warn)]">
            Due Steps
          </p>
          <span className="rounded-full bg-[var(--warn-tint)] px-1.5 py-0.5 text-caption font-medium text-[var(--warn)]">
            {dueEnrollments.length}
          </span>
        </div>
        <button
          onClick={handleSendAll}
          disabled={isPending}
          className="tap flex items-center justify-center self-start rounded-[var(--r-md)] bg-[var(--ok-tint)] px-4 text-xs font-medium text-[var(--ok)] transition-colors hover:opacity-90 disabled:opacity-50 sm:self-auto"
        >
          {isPending
            ? "Logging…"
            : `Log All as Sent (${dueEnrollments.length})`}
        </button>
      </div>

      {batchError && (
        <p className="border-b border-[var(--line-1)] px-4 py-2 text-xs text-[var(--bad)]">
          {batchError}
        </p>
      )}
      {batchDone !== null && (
        <p className="border-b border-[var(--line-1)] px-4 py-2 text-xs text-[var(--ok)]">
          Logged {batchDone} {batchDone === 1 ? "step" : "steps"} as sent.
          {batchRemaining > 0
            ? ` ${batchRemaining} remaining — click again to continue.`
            : ""}
        </p>
      )}

      {/* Mobile: card list */}
      <ul className="divide-y divide-[var(--line-1)] sm:hidden">
        {dueEnrollments.map((e) => (
          <li key={e.enrollmentId} className="px-4 py-4 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <Link
                  href={`/contacts/${e.contactId}`}
                  className="block truncate text-body font-medium text-[var(--ink-1)] transition-colors hover:text-[var(--accent)]"
                >
                  {e.contactName}
                </Link>
                {e.contactEmail && (
                  <p className="truncate text-footnote text-[var(--ink-3)]">
                    {e.contactEmail}
                  </p>
                )}
              </div>
              <span className="shrink-0 text-caption font-medium text-[var(--warn)]">
                {e.daysOverdue === 0 ? "Today" : `${e.daysOverdue}d overdue`}
              </span>
            </div>
            <Link
              href={`/sequences/${e.sequenceId}`}
              className="block truncate text-footnote text-[var(--ink-2)] transition-colors hover:text-[var(--accent)]"
            >
              {e.sequenceName}
            </Link>
            <p className="truncate text-footnote text-[var(--ink-3)]">{e.stepSubjectTemplate}</p>
            <div className="pt-0.5">
              <SendStepButton
                enrollmentId={e.enrollmentId}
                sequenceId={e.sequenceId}
                contactId={e.contactId}
                contactName={e.contactName}
                contactEmail={e.contactEmail}
                contactCompany={e.contactCompany}
                contactOwner={e.contactOwner}
                stepSubjectTemplate={e.stepSubjectTemplate}
                stepBodyTemplate={e.stepBodyTemplate}
                stepPosition={e.stepPosition}
                newStepPosition={e.newStepPosition}
                totalSteps={e.totalSteps}
                defaultOwnerName={defaultOwnerName}
              />
            </div>
          </li>
        ))}
      </ul>

      {/* Desktop: table */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--line-1)] text-left">
              <th className="px-5 py-3 text-caption font-medium uppercase tracking-wide text-[var(--ink-3)]">
                Contact
              </th>
              <th className="px-5 py-3 text-caption font-medium uppercase tracking-wide text-[var(--ink-3)]">
                Sequence
              </th>
              <th className="px-5 py-3 text-caption font-medium uppercase tracking-wide text-[var(--ink-3)]">
                Step subject
              </th>
              <th className="px-5 py-3 text-caption font-medium uppercase tracking-wide text-[var(--ink-3)]">
                Overdue
              </th>
              <th className="w-px whitespace-nowrap px-5 py-3 text-right" />
            </tr>
          </thead>
          <tbody>
            {dueEnrollments.map((e) => (
              <tr
                key={e.enrollmentId}
                className="border-b border-[var(--line-1)] last:border-0 transition-colors hover:bg-[var(--surface-2)]/40"
              >
                <td className="px-5 py-3">
                  <Link
                    href={`/contacts/${e.contactId}`}
                    className="font-medium text-[var(--ink-1)] transition-colors hover:text-[var(--accent)]"
                  >
                    {e.contactName}
                  </Link>
                  {e.contactEmail && (
                    <p className="truncate text-xs text-[var(--ink-3)]">
                      {e.contactEmail}
                    </p>
                  )}
                </td>
                <td className="px-5 py-3">
                  <Link
                    href={`/sequences/${e.sequenceId}`}
                    className="text-[var(--ink-2)] transition-colors hover:text-[var(--accent)]"
                  >
                    {e.sequenceName}
                  </Link>
                </td>
                <td className="max-w-xs px-5 py-3 text-[var(--ink-2)]">
                  <span className="block truncate">{e.stepSubjectTemplate}</span>
                </td>
                <td className="px-5 py-3">
                  <span className="text-xs font-medium text-[var(--warn)]">
                    {e.daysOverdue === 0 ? "Today" : `${e.daysOverdue}d`}
                  </span>
                </td>
                <td className="w-px whitespace-nowrap px-5 py-3 text-right">
                  <SendStepButton
                    enrollmentId={e.enrollmentId}
                    sequenceId={e.sequenceId}
                    contactId={e.contactId}
                    contactName={e.contactName}
                    contactEmail={e.contactEmail}
                    contactCompany={e.contactCompany}
                    contactOwner={e.contactOwner}
                    stepSubjectTemplate={e.stepSubjectTemplate}
                    stepBodyTemplate={e.stepBodyTemplate}
                    stepPosition={e.stepPosition}
                    newStepPosition={e.newStepPosition}
                    totalSteps={e.totalSteps}
                    defaultOwnerName={defaultOwnerName}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
