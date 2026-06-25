"use client";

import { useTransition } from "react";
import { updateSequenceStatus } from "./actions";

interface Props {
  id: number;
  status: "active" | "paused";
}

export function SequenceStatusToggle({ id, status }: Props) {
  const [isPending, startTransition] = useTransition();
  const nextStatus = status === "active" ? "paused" : "active";

  function handleToggle() {
    startTransition(async () => {
      await updateSequenceStatus(id, nextStatus);
    });
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      className={`tap inline-flex items-center justify-center rounded-md px-3 text-xs font-medium transition-colors disabled:opacity-50 ${
        status === "active"
          ? "text-[--warn] hover:opacity-80"
          : "text-[--ok] hover:opacity-80"
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
