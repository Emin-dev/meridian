"use client";

import { useActionState, useEffect } from "react";
import { updateDealNotes, type UpdateNotesState } from "./actions";
import { useToast } from "@/components/toaster";

const INIT: UpdateNotesState = {};

export default function EditNotesForm({
  dealId,
  initialNotes,
}: {
  dealId: number;
  initialNotes: string | null;
}) {
  const action = updateDealNotes.bind(null, dealId);
  const [state, formAction, pending] = useActionState(action, INIT);
  const { toast } = useToast();

  useEffect(() => {
    if (state.success) toast("Notes saved");
    if (state.error) toast(state.error, "error");
  }, [state.success, state.error, toast]);

  return (
    <form action={formAction} className="space-y-3">
      {state.noDb && (
        <p className="text-xs text-amber-400">
          Database not connected — notes cannot be saved.
        </p>
      )}
      <textarea
        name="notes"
        rows={4}
        placeholder="Add notes about this deal…"
        defaultValue={initialNotes ?? ""}
        className="w-full resize-none rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-indigo-500 focus:outline-none"
      />
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save notes"}
        </button>
      </div>
    </form>
  );
}
