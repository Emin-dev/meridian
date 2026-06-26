"use client";

import { useOptimistic, useTransition } from "react";
import { toggleActivityComplete } from "./actions";

interface Props {
  activityId: number;
  isCompleted: boolean;
  contactId: number | null;
  dealId: number | null;
}

export default function ActivityToggle({
  activityId,
  isCompleted,
  contactId,
  dealId,
}: Props) {
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
            await toggleActivityComplete(activityId, isCompleted, contactId, dealId);
          });
        }}
        className="h-4 w-4 cursor-pointer rounded border-[--line-2] bg-[--surface-2] accent-[--accent] disabled:opacity-50"
      />
    </label>
  );
}
