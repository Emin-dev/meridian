"use client";

import { useTransition } from "react";
import { deleteDeal } from "./actions";

export default function DeleteDealButton({ dealId }: { dealId: number }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm("Delete this deal? This cannot be undone.")) return;
        startTransition(() => void deleteDeal(dealId));
      }}
      className="rounded-lg border border-red-800 bg-red-900/20 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-900/40 disabled:opacity-50"
    >
      {pending ? "Deleting…" : "Delete deal"}
    </button>
  );
}
