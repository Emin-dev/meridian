"use client";

import { useTransition } from "react";
import { deleteSequence } from "./actions";

export default function DeleteSequenceButton({
  sequenceId,
}: {
  sequenceId: number;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (
          !confirm(
            "Delete this sequence? Its steps and all enrollments will be removed. This cannot be undone."
          )
        )
          return;
        startTransition(() => void deleteSequence(sequenceId));
      }}
      className="tap inline-flex items-center justify-center rounded-lg border border-[var(--bad)]/40 bg-[var(--bad-tint)] px-4 text-sm font-medium text-[var(--bad)] transition-colors hover:bg-[var(--bad)]/20 disabled:opacity-50"
    >
      {pending ? "Deleting…" : "Delete sequence"}
    </button>
  );
}
