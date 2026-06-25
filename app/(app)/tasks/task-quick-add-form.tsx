"use client";

import { useActionState, useEffect, useState } from "react";
import { addTask, type AddTaskState } from "./actions";
import { useToast } from "@/components/toaster";

const INIT: AddTaskState = {};

const inputCls =
  "w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-indigo-500 focus:outline-none";
const labelCls = "mb-1 block text-xs font-medium text-neutral-400";

export default function TaskQuickAddForm() {
  const [state, formAction, pending] = useActionState(addTask, INIT);
  const [formKey, setFormKey] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    if (state.success) {
      setFormKey((k) => k + 1);
      toast("Task added");
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
            save tasks.
          </p>
        </div>
      )}

      <form key={formKey} action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="tqf-subject" className={labelCls}>
            Subject <span className="text-red-400">*</span>
          </label>
          <input
            id="tqf-subject"
            name="subject"
            type="text"
            required
            placeholder="e.g. Send proposal to Acme"
            className={inputCls}
          />
          {state.fieldErrors?.subject && (
            <p className="mt-1 text-xs text-red-400">
              {state.fieldErrors.subject[0]}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="tqf-due" className={labelCls}>
            Due date <span className="text-red-400">*</span>
          </label>
          <input
            id="tqf-due"
            name="dueAt"
            type="date"
            required
            className={`${inputCls} [color-scheme:dark] sm:w-40`}
          />
          {state.fieldErrors?.dueAt && (
            <p className="mt-1 text-xs text-red-400">
              {state.fieldErrors.dueAt[0]}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add task"}
        </button>
      </form>
    </div>
  );
}
