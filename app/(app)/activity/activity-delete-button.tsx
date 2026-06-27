"use client";

import { useTransition } from "react";
import { deleteActivity } from "./actions";
import { useToast } from "@/components/toaster";

interface Props {
  activityId: number;
  contactId: number | null;
  dealId: number | null;
  /** Optional callback fired after a successful delete (e.g. close a sheet). */
  onDeleted?: () => void;
  className?: string;
}

export default function ActivityDeleteButton({
  activityId,
  contactId,
  dealId,
  onDeleted,
  className,
}: Props) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!window.confirm("Delete this activity? This can't be undone.")) return;
        startTransition(async () => {
          const result = await deleteActivity(activityId, contactId, dealId);
          if (result?.error) {
            toast(result.error, "error");
            return;
          }
          toast("Activity deleted", "success");
          onDeleted?.();
        });
      }}
      className={
        className ??
        "tap inline-flex items-center text-caption text-[var(--bad)] transition-colors hover:text-[var(--bad)]/80 disabled:opacity-50"
      }
    >
      {pending ? "…" : "Delete"}
    </button>
  );
}
