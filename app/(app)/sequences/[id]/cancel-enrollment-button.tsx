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
      className="text-xs text-red-400 transition-colors hover:text-red-300 disabled:opacity-50"
    >
      {isPending ? "Cancelling…" : "Cancel"}
    </button>
  );
}
