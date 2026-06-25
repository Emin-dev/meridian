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

  if (dueEnrollments.length === 0) return null;

  function handleSendAll() {
    setBatchError(null);
    setBatchDone(null);
    const ids = dueEnrollments.map((e) => e.enrollmentId);
    startTransition(async () => {
      const result = await sendAllDueSteps(ids);
      if (result.error) {
        setBatchError(result.error);
      } else {
        setBatchDone(result.sent);
      }
    });
  }

  return (
    <div className="rounded-xl border border-amber-500/30 bg-neutral-900">
      <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-3">
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-400">
            Due Steps
          </p>
          <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-xs font-medium text-amber-400">
            {dueEnrollments.length}
          </span>
        </div>
        <button
          onClick={handleSendAll}
          disabled={isPending}
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
        >
          {isPending
            ? "Sending…"
            : `Send All Due (${dueEnrollments.length})`}
        </button>
      </div>

      {batchError && (
        <p className="border-b border-neutral-800 px-5 py-2 text-xs text-red-400">
          {batchError}
        </p>
      )}
      {batchDone !== null && (
        <p className="border-b border-neutral-800 px-5 py-2 text-xs text-emerald-400">
          Marked {batchDone} {batchDone === 1 ? "step" : "steps"} as sent.
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-800 text-left">
              <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
                Contact
              </th>
              <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
                Sequence
              </th>
              <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
                Step subject
              </th>
              <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
                Overdue
              </th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {dueEnrollments.map((e) => (
              <tr
                key={e.enrollmentId}
                className="border-b border-neutral-800 last:border-0 transition-colors hover:bg-neutral-800/40"
              >
                <td className="px-5 py-3">
                  <Link
                    href={`/contacts/${e.contactId}`}
                    className="font-medium text-neutral-100 transition-colors hover:text-indigo-400"
                  >
                    {e.contactName}
                  </Link>
                  {e.contactEmail && (
                    <p className="truncate text-xs text-neutral-500">
                      {e.contactEmail}
                    </p>
                  )}
                </td>
                <td className="px-5 py-3">
                  <Link
                    href={`/sequences/${e.sequenceId}`}
                    className="text-neutral-300 transition-colors hover:text-indigo-400"
                  >
                    {e.sequenceName}
                  </Link>
                </td>
                <td className="max-w-xs px-5 py-3 text-neutral-400">
                  <span className="block truncate">{e.stepSubjectTemplate}</span>
                </td>
                <td className="px-5 py-3">
                  <span className="text-xs font-medium text-amber-400">
                    {e.daysOverdue === 0 ? "Today" : `${e.daysOverdue}d`}
                  </span>
                </td>
                <td className="px-5 py-3">
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
