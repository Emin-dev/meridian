"use client";

import { useActionState, useEffect, useState } from "react";
import { addActivity, type AddActivityState } from "./actions";
import { useToast } from "@/components/toaster";

const INIT: AddActivityState = {};
const ACTIVITY_TYPES = ["call", "email", "meeting", "note", "task"] as const;

const inputCls =
  "w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-indigo-500 focus:outline-none";
const labelCls = "mb-1 block text-xs font-medium text-neutral-400";

export default function AddActivityForm({
  contactId,
  dealId,
  onSuccess,
}: {
  contactId?: number;
  dealId?: number;
  onSuccess?: () => void;
}) {
  const [state, formAction, pending] = useActionState(addActivity, INIT);
  const [formKey, setFormKey] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    if (state.success) {
      setFormKey((k) => k + 1);
      toast("Activity logged");
      onSuccess?.();
    }
    if (state.error) toast(state.error, "error");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success, state.error, toast]);

  return (
    <div className="space-y-3">
      {state.noDb && (
        <div className="rounded-lg border border-amber-800 bg-amber-900/20 px-3 py-2">
          <p className="text-xs text-amber-400">
            Database not connected — set{" "}
            <code className="rounded bg-neutral-800 px-1">DATABASE_URL</code> to
            save activities.
          </p>
        </div>
      )}

      <form key={formKey} action={formAction} className="space-y-3">
        {contactId != null && (
          <input type="hidden" name="contactId" value={String(contactId)} />
        )}
        {dealId != null && (
          <input type="hidden" name="dealId" value={String(dealId)} />
        )}

        <div className="flex flex-col gap-3 sm:flex-row">
          <div>
            <label htmlFor="af-type" className={labelCls}>
              Type
            </label>
            <select
              id="af-type"
              name="type"
              defaultValue="note"
              className={inputCls}
            >
              {ACTIVITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1">
            <label htmlFor="af-subject" className={labelCls}>
              Subject <span className="text-red-400">*</span>
            </label>
            <input
              id="af-subject"
              name="subject"
              type="text"
              required
              placeholder="e.g. Follow-up call with CEO"
              className={inputCls}
            />
            {state.fieldErrors?.subject && (
              <p className="mt-1 text-xs text-red-400">
                {state.fieldErrors.subject[0]}
              </p>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="af-body" className={labelCls}>
            Notes
          </label>
          <textarea
            id="af-body"
            name="body"
            rows={2}
            placeholder="Optional details..."
            className={`${inputCls} resize-none`}
          />
        </div>

        <div>
          <label htmlFor="af-due" className={labelCls}>
            Due date <span className="text-neutral-600">(optional)</span>
          </label>
          <input
            id="af-due"
            name="dueAt"
            type="date"
            className={`${inputCls} [color-scheme:dark]`}
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            id="af-completed"
            name="completedAt"
            type="checkbox"
            className="h-3.5 w-3.5 rounded border-neutral-600 bg-neutral-800 accent-indigo-500"
          />
          <label htmlFor="af-completed" className="text-xs text-neutral-400 cursor-pointer select-none">
            Mark as completed
          </label>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
          >
            {pending ? "Logging…" : "Log activity"}
          </button>
        </div>
      </form>
    </div>
  );
}
