"use client";

import { useState } from "react";
import Link from "next/link";
import MobileActionSheet from "@/components/mobile-action-sheet";
import { SendStepButton } from "./send-step-button";
import { CancelEnrollmentButton } from "./cancel-enrollment-button";

export type EnrollmentSendStep = {
  contactCompany: string | null;
  contactOwner: string | null;
  stepSubjectTemplate: string;
  stepBodyTemplate: string;
  stepPosition: number;
  newStepPosition: number;
};

export type EnrollmentRow = {
  id: number;
  contactId: number;
  contactName: string;
  contactEmail: string | null;
  status: "active" | "cancelled" | "completed";
  statusLabel: string;
  statusClassName: string;
  progressLabel: string | null;
  dueLabel: string | null;
  pct: number;
  totalSteps: number;
  isActive: boolean;
  isCancelled: boolean;
  isCompleted: boolean;
  isComplete: boolean;
  sendStep: EnrollmentSendStep | null;
};

interface Props {
  rows: EnrollmentRow[];
  sequenceId: number;
  defaultOwnerName: string;
}

function barClass(row: EnrollmentRow) {
  if (row.isCancelled) return "bg-[var(--ink-3)]";
  if (row.isCompleted || row.isComplete) return "bg-[var(--ok)]";
  return "bg-[var(--ok)]/70";
}

/**
 * Mobile (<lg) view of sequence enrollments.
 *
 * Renders calm, glanceable cards — contact name, status badge, and a progress
 * bar — and pushes the dense detail (full progress text + the Send / Cancel
 * actions) into a tap-to-expand bottom sheet, mirroring the iOS-Weather pattern
 * used across Meridian. Desktop keeps the original dense list.
 */
export function EnrollmentCardsMobile({ rows, sequenceId, defaultOwnerName }: Props) {
  const [openId, setOpenId] = useState<number | null>(null);
  const active = rows.find((r) => r.id === openId) ?? null;

  return (
    <>
      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.id}>
            <button
              type="button"
              onClick={() => setOpenId(row.id)}
              className="tap press w-full rounded-[var(--r-lg)] border border-[var(--line-1)] bg-[var(--surface-1)] p-4 text-left"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 flex-1 truncate text-body font-medium text-[var(--ink-1)]">
                  {row.contactName}
                </p>
                <span
                  className={`shrink-0 inline-block rounded-full px-2 py-0.5 text-caption font-medium ${row.statusClassName}`}
                >
                  {row.statusLabel}
                </span>
              </div>
              {row.progressLabel && (
                <p className="mt-1 text-footnote text-[var(--ink-3)]">
                  {row.progressLabel}
                  {row.dueLabel ? ` · ${row.dueLabel}` : ""}
                </p>
              )}
              {row.totalSteps > 0 && (
                <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
                  <div
                    className={`h-full rounded-full ${barClass(row)}`}
                    style={{ width: `${row.pct}%` }}
                  />
                </div>
              )}
            </button>
          </li>
        ))}
      </ul>

      <MobileActionSheet
        open={active !== null}
        onClose={() => setOpenId(null)}
        title="Enrollment"
      >
        {active && (
          <div className="space-y-4">
            {/* Name + status */}
            <div className="flex items-start justify-between gap-3">
              <h3 className="min-w-0 flex-1 text-callout font-semibold text-[var(--ink-1)]">
                {active.contactName}
              </h3>
              <span
                className={`shrink-0 inline-block rounded-full px-2 py-0.5 text-caption font-medium ${active.statusClassName}`}
              >
                {active.statusLabel}
              </span>
            </div>

            {active.contactEmail && (
              <p className="-mt-2 break-words text-footnote text-[var(--ink-3)]">
                {active.contactEmail}
              </p>
            )}

            {/* Progress */}
            {active.totalSteps > 0 && (
              <div>
                <p className="text-footnote text-[var(--ink-3)]">
                  {active.progressLabel}
                  {active.dueLabel ? ` · ${active.dueLabel}` : ""}
                </p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
                  <div
                    className={`h-full rounded-full ${barClass(active)}`}
                    style={{ width: `${active.pct}%` }}
                  />
                </div>
              </div>
            )}

            {/* Actions */}
            {(active.sendStep || active.isActive) && (
              <div className="flex flex-wrap items-center gap-2">
                {active.sendStep && (
                  <SendStepButton
                    enrollmentId={active.id}
                    sequenceId={sequenceId}
                    contactId={active.contactId}
                    contactName={active.contactName}
                    contactEmail={active.contactEmail}
                    contactCompany={active.sendStep.contactCompany}
                    contactOwner={active.sendStep.contactOwner}
                    stepSubjectTemplate={active.sendStep.stepSubjectTemplate}
                    stepBodyTemplate={active.sendStep.stepBodyTemplate}
                    stepPosition={active.sendStep.stepPosition}
                    newStepPosition={active.sendStep.newStepPosition}
                    totalSteps={active.totalSteps}
                    defaultOwnerName={defaultOwnerName}
                  />
                )}
                {active.isActive && (
                  <CancelEnrollmentButton
                    enrollmentId={active.id}
                    sequenceId={sequenceId}
                  />
                )}
              </div>
            )}

            {/* Link to the full contact record */}
            <Link
              href={`/contacts/${active.contactId}`}
              className="tap inline-flex items-center text-footnote text-[var(--ink-2)] transition-colors hover:text-[var(--ink-1)]"
            >
              View full contact →
            </Link>
          </div>
        )}
      </MobileActionSheet>
    </>
  );
}
