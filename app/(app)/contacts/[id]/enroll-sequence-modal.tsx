"use client";

import { useEffect, useRef, useState, useTransition } from "react";
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
  // `activeEnrollmentIds` is the server source of truth. We keep a local
  // optimistic set only for instant feedback between clicking Enroll and the
  // revalidatePath round-trip. It resets whenever the prop changes so that an
  // enroll/cancel performed elsewhere (e.g. the page's Cancel button) is
  // reflected the next time the modal is opened.
  const enrolledKey = activeEnrollmentIds.join(",");
  const [optimisticIds, setOptimisticIds] = useState<Set<number>>(new Set());
  useEffect(() => {
    setOptimisticIds(new Set());
  }, [enrolledKey]);
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
        setOptimisticIds((prev) => new Set([...prev, sequenceId]));
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
        className="tap inline-flex items-center justify-center rounded-lg border border-[var(--line-1)] px-4 text-sm font-medium text-[var(--ink-2)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink-1)]"
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
          border border-[var(--line-1)] bg-[var(--surface-1)] p-0 text-[var(--ink-1)] shadow-2xl
          backdrop:bg-black/60
          sm:m-auto sm:inset-0 sm:max-w-md sm:w-full sm:rounded-xl
        "
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between border-b border-[var(--line-1)] px-6 py-4">
          <h2 className="text-base font-semibold">Enroll in Sequence</h2>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="tap inline-flex items-center justify-center rounded-md text-[var(--ink-2)] hover:bg-[var(--surface-2)] hover:text-[var(--ink-1)]"
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
              <p className="text-sm text-[var(--ink-2)]">
                No active sequences found.
              </p>
              <p className="mt-1 text-xs text-[var(--ink-3)]">
                Create a sequence first, then enroll this contact.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {sequences.map((seq) => {
                const enrolled =
                  activeEnrollmentIds.includes(seq.id) ||
                  optimisticIds.has(seq.id);
                const isEnrolling = enrollingId === seq.id && isPending;
                return (
                  <li
                    key={seq.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line-1)] bg-[var(--surface-2)] px-4 py-3"
                  >
                    <span className="text-sm text-[var(--ink-1)]">{seq.name}</span>
                    <div className="flex shrink-0 items-center gap-2">
                      {errors[seq.id] && (
                        <span className="text-xs text-[var(--bad)]">
                          {errors[seq.id]}
                        </span>
                      )}
                      {enrolled ? (
                        <span className="rounded-full bg-[var(--ok-tint)] px-2.5 py-0.5 text-xs font-medium text-[var(--ok)]">
                          Enrolled
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleEnroll(seq.id)}
                          disabled={isEnrolling || isPending}
                          className="tap inline-flex items-center justify-center rounded-lg bg-[var(--accent)] px-3 text-xs font-medium text-[var(--accent-ink)] transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50"
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

        <div className="shrink-0 flex justify-end border-t border-[var(--line-1)] px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="tap inline-flex items-center justify-center rounded-lg px-4 text-sm text-[var(--ink-2)] hover:bg-[var(--surface-2)] hover:text-[var(--ink-1)]"
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
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  function handleCancel() {
    startTransition(async () => {
      const result = await cancelEnrollment(enrollmentId, contactId);
      if (result.error) toast(result.error, "error");
    });
  }

  return (
    <button
      type="button"
      onClick={handleCancel}
      disabled={isPending}
      className="tap inline-flex items-center justify-center rounded-lg px-3 text-xs font-medium text-[var(--ink-2)] transition-colors hover:bg-[var(--bad-tint)] hover:text-[var(--bad)] disabled:opacity-50"
    >
      {isPending ? "Cancelling…" : "Cancel"}
    </button>
  );
}
