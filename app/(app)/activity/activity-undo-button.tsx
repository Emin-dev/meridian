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
      className="tap inline-flex items-center text-caption text-[--accent] transition-colors hover:text-[--accent-hover] disabled:opacity-50"
    >
      {pending ? "…" : "Undo"}
    </button>
  );
}
