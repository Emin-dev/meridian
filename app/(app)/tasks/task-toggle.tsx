"use client";

import { useTransition } from "react";
import { toggleTaskComplete } from "./actions";

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
  const [pending, startTransition] = useTransition();

  return (
    <input
      type="checkbox"
      checked={isCompleted}
      disabled={pending}
      aria-label={isCompleted ? "Mark incomplete" : "Mark complete"}
      onChange={() => {
        startTransition(async () => {
          await toggleTaskComplete(activityId, isCompleted, contactId, dealId);
        });
      }}
      className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-neutral-600 bg-neutral-800 accent-indigo-500 disabled:opacity-50"
    />
  );
}
