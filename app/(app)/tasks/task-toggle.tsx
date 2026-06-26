"use client";

import { useOptimistic, useTransition } from "react";
import { toggleTaskComplete } from "./actions";
import { useToast } from "@/components/toaster";

interface Props {
  activityId: number;
  isCompleted: boolean;
  contactId: number | null;
  dealId: number | null;
}

export default function TaskToggle({
  activityId,
  isCompleted,
  contactId,
  dealId,
}: Props) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  // Optimistic mirror of `isCompleted`: flips instantly on toggle, then
  // reconciles to the revalidated prop on success or reverts on failure.
  const [optimisticCompleted, setOptimisticCompleted] =
    useOptimistic(isCompleted);

  return (
    <label className="tap flex shrink-0 cursor-pointer items-center justify-center">
      <input
        type="checkbox"
        checked={optimisticCompleted}
        disabled={pending}
        aria-label={optimisticCompleted ? "Mark incomplete" : "Mark complete"}
        onChange={() => {
          startTransition(async () => {
            setOptimisticCompleted(!isCompleted);
            // On failure the optimistic value auto-reverts to `isCompleted`
            // when the transition ends; surface a toast so the dropped write
            // is visible instead of the checkbox silently snapping back.
            const result = await toggleTaskComplete(
              activityId,
              isCompleted,
              contactId,
              dealId,
            );
            if (result?.error) toast(result.error, "error");
          });
        }}
        className="h-4 w-4 cursor-pointer rounded border-[var(--line-2)] bg-[var(--surface-2)] accent-[var(--accent)] disabled:opacity-50"
      />
    </label>
  );
}
