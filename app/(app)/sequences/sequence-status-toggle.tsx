"use client";

import { useTransition } from "react";
import { updateSequenceStatus } from "./actions";
import { useToast } from "@/components/toaster";

interface Props {
  id: number;
  status: "active" | "paused";
}

export function SequenceStatusToggle({ id, status }: Props) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const nextStatus = status === "active" ? "paused" : "active";

  function handleToggle() {
    startTransition(async () => {
      const result = await updateSequenceStatus(id, nextStatus);
      if (result?.error) toast(result.error, "error");
    });
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      className={`tap inline-flex items-center justify-center border border-[var(--line-1)] bg-[var(--surface-2)] rounded-[var(--r-md)] px-2.5 text-xs font-medium transition-colors disabled:opacity-50 ${
        status === "active"
          ? "text-[var(--warn)] hover:opacity-80"
          : "text-[var(--ok)] hover:opacity-80"
      }`}
    >
      {isPending
        ? status === "active"
          ? "Pausing…"
          : "Resuming…"
        : status === "active"
          ? "Pause"
          : "Resume"}
    </button>
  );
}
