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
      className="tap inline-flex items-center justify-center rounded-lg border border-[var(--bad)]/40 bg-[var(--bad-tint)] px-4 text-sm font-medium text-[var(--bad)] transition-colors hover:bg-[var(--bad)]/20 disabled:opacity-50"
    >
      {pending ? "Deleting…" : "Delete deal"}
    </button>
  );
}
