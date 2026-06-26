"use client";

import { useRef, useState, useTransition } from "react";
import { useToast } from "@/components/toaster";
import { enrollInSequence, cancelEnrollment } from "./enrollment-actions";

interface Sequence {
  id: number;
  name: string;
}

interface Props {
  contactId: number;
  sequences: Sequence[];
  activeEnrollmentIds: number[];
}

export default function EnrollSequenceModal({
  contactId,
  sequences,
  activeEnrollmentIds,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { toast } = useToast();
  const [enrolledIds, setEnrolledIds] = useState<Set<number>>(
    () => new Set(activeEnrollmentIds)
  );
  const [enrollingId, setEnrollingId] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [isPending, startTransition] = useTransition();

  const openModal = () => {
    // Never let two modals stack/overlap: close any other open dialog first.
    document
      .querySelectorAll("dialog[open]")
      .forEach((d) => (d as HTMLDialogElement).close());
    dialogRef.current?.showModal();
  };

  function handleEnroll(sequenceId: number) {
    setEnrollingId(sequenceId);
    setErrors({});
    startTransition(async () => {
      const result = await enrollInSequence(contactId, sequenceId);
      setEnrollingId(null);
      if (result.success) {
        setEnrolledIds((prev) => new Set([...prev, sequenceId]));
        toast("Enrolled in sequence");
      } else if (result.noDb) {
        setErrors((prev) => ({
          ...prev,
          [sequenceId]: "Database not connected.",
        }));
      } else if (result.error) {
        setErrors((prev) => ({ ...prev, [sequenceId]: result.error! }));
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="rounded-lg border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-neutral-100"
      >
        Enroll in sequence
      </button>

      <dialog
        ref={dialogRef}
        aria-label="Enroll in sequence"
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current?.close();
        }}
        className="
          m-0 inset-x-0 bottom-0 top-auto
          w-full max-w-none rounded-t-[var(--r-2xl)]
          max-h-[90dvh] overflow-hidden flex flex-col
          border border-neutral-800 bg-neutral-900 p-0 text-neutral-100 shadow-2xl
          backdrop:bg-black/60
          sm:m-auto sm:inset-0 sm:max-w-md sm:w-full sm:rounded-xl
        "
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between border-b border-neutral-800 px-6 py-4">
          <h2 className="text-base font-semibold">Enroll in Sequence</h2>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="rounded-md p-1 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
            aria-label="Close"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {sequences.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-neutral-400">
                No active sequences found.
              </p>
              <p className="mt-1 text-xs text-neutral-600">
                Create a sequence first, then enroll this contact.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {sequences.map((seq) => {
                const enrolled = enrolledIds.has(seq.id);
                const isEnrolling = enrollingId === seq.id && isPending;
                return (
                  <li
                    key={seq.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-800/50 px-4 py-3"
                  >
                    <span className="text-sm text-neutral-200">{seq.name}</span>
                    <div className="flex shrink-0 items-center gap-2">
                      {errors[seq.id] && (
                        <span className="text-xs text-red-400">
                          {errors[seq.id]}
                        </span>
                      )}
                      {enrolled ? (
                        <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                          Enrolled
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleEnroll(seq.id)}
                          disabled={isEnrolling || isPending}
                          className="rounded-lg bg-[--accent] px-3 py-1.5 text-xs font-medium text-[--accent-ink] transition-colors hover:bg-[--accent-hover] disabled:opacity-50"
                        >
                          {isEnrolling ? "Enrolling…" : "Enroll"}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="shrink-0 flex justify-end border-t border-neutral-800 px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="rounded-lg px-4 py-2 text-sm text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
          >
            Done
          </button>
        </div>
      </dialog>
    </>
  );
}

export function CancelEnrollmentButton({
  enrollmentId,
  contactId,
}: {
  enrollmentId: number;
  contactId: number;
}) {
  const [isPending, startTransition] = useTransition();

  function handleCancel() {
    startTransition(async () => {
      await cancelEnrollment(enrollmentId, contactId);
    });
  }

  return (
    <button
      type="button"
      onClick={handleCancel}
      disabled={isPending}
      className="rounded-lg px-3 py-1.5 text-xs font-medium text-neutral-400 transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
    >
      {isPending ? "Cancelling…" : "Cancel"}
    </button>
  );
}
