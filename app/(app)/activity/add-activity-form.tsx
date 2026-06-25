"use client";

import { useActionState, useEffect, useState } from "react";
import { addActivity, type AddActivityState } from "./actions";

const INIT: AddActivityState = {};
const ACTIVITY_TYPES = ["call", "email", "meeting", "note", "task"] as const;

const inputCls =
  "w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-indigo-500 focus:outline-none";
const labelCls = "mb-1 block text-xs font-medium text-neutral-400";

export default function AddActivityForm({ contactId }: { contactId?: number }) {
  const [state, formAction, pending] = useActionState(addActivity, INIT);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    if (state.success) {
      setFormKey((k) => k + 1);
    }
  }, [state]);

  return (
    <div className="space-y-3">
      {state.success && (
        <div className="rounded-lg border border-emerald-800 bg-emerald-900/30 px-3 py-2">
          <p className="text-xs text-emerald-400">Activity logged.</p>
        </div>
      )}
      {state.noDb && (
        <div className="rounded-lg border border-amber-800 bg-amber-900/20 px-3 py-2">
          <p className="text-xs text-amber-400">
            Database not connected — set{" "}
            <code className="rounded bg-neutral-800 px-1">DATABASE_URL</code> to
            save activities.
          </p>
        </div>
      )}
      {state.error && (
        <p className="text-xs text-red-400">{state.error}</p>
      )}

      <form key={formKey} action={formAction} className="space-y-3">
        {contactId != null && (
          <input type="hidden" name="contactId" value={String(contactId)} />
        )}

        <div className="flex gap-3">
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
