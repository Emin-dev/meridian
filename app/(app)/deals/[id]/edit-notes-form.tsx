"use client";

import { useActionState, useEffect, useState } from "react";
import { updateDealNotes, type UpdateNotesState } from "./actions";
import { useToast } from "@/components/toaster";
import MarkdownContent from "@/components/markdown-content";

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
  const [isEditing, setIsEditing] = useState(!initialNotes);

  useEffect(() => {
    if (state.success) {
      toast("Notes saved");
      setIsEditing(false);
    }
    if (state.error) toast(state.error, "error");
  }, [state.success, state.error, toast]);

  if (!isEditing && initialNotes) {
    return (
      <div className="space-y-3">
        <MarkdownContent content={initialNotes} />
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-400 transition-colors hover:border-neutral-600 hover:text-neutral-200"
          >
            Edit
          </button>
        </div>
      </div>
    );
  }

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
        className="w-full resize-none rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-[--accent] focus:outline-none"
      />
      <div className="flex items-center justify-end gap-2">
        {initialNotes && (
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-400 transition-colors hover:border-neutral-600 hover:text-neutral-200"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-[--accent] px-4 py-2 text-sm font-medium text-[--accent-ink] transition-colors hover:bg-[--accent-hover] disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save notes"}
        </button>
      </div>
    </form>
  );
}
