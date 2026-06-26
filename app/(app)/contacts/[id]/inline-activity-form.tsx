"use client";

import { useState } from "react";
import AddActivityForm from "@/app/(app)/activity/add-activity-form";

export default function InlineActivityForm({
  contactId,
  dealId,
}: {
  contactId?: number;
  dealId?: number;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-sm text-[--accent] transition-colors hover:text-[--accent-hover]"
      >
        <span aria-hidden className="text-base leading-none">+</span>
        Log activity
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-neutral-700 bg-neutral-800/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-neutral-300">Log activity</span>
        <button
          onClick={() => setOpen(false)}
          aria-label="Close form"
          className="text-neutral-500 transition-colors hover:text-neutral-300"
        >
          ✕
        </button>
      </div>
      <AddActivityForm contactId={contactId} dealId={dealId} onSuccess={() => setOpen(false)} />
    </div>
  );
}
