"use client";

import { useTransition } from "react";
import { cancelEnrollmentFromSequence } from "./enrollment-actions";

interface Props {
  enrollmentId: number;
  sequenceId: number;
}

export function CancelEnrollmentButton({ enrollmentId, sequenceId }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleCancel() {
    startTransition(async () => {
      await cancelEnrollmentFromSequence(enrollmentId, sequenceId);
    });
  }

  return (
    <button
      onClick={handleCancel}
      disabled={isPending}
      className="tap inline-flex items-center justify-center rounded-md px-3 text-xs text-[var(--bad)] transition-colors hover:opacity-80 disabled:opacity-50"
    >
      {isPending ? "Cancelling…" : "Cancel"}
    </button>
  );
}
