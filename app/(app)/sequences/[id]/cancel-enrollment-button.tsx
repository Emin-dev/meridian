"use client";

import { useTransition } from "react";
import { useToast } from "@/components/toaster";
import { cancelEnrollmentFromSequence } from "./enrollment-actions";

interface Props {
  enrollmentId: number;
  sequenceId: number;
}

export function CancelEnrollmentButton({ enrollmentId, sequenceId }: Props) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  function handleCancel() {
    startTransition(async () => {
      const result = await cancelEnrollmentFromSequence(enrollmentId, sequenceId);
      if (result.error) toast(result.error, "error");
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
