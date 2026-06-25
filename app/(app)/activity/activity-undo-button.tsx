"use client";

import { useTransition } from "react";
import { toggleActivityComplete } from "./actions";

interface Props {
  activityId: number;
  contactId: number | null;
  dealId: number | null;
}

export default function ActivityUndoButton({ activityId, contactId, dealId }: Props) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await toggleActivityComplete(activityId, true, contactId, dealId);
        });
      }}
      className="text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-50 transition-colors"
    >
      {pending ? "…" : "Undo"}
    </button>
  );
}
