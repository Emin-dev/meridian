"use client";

import { useActionState, useEffect, useState } from "react";
import { addTask, type AddTaskState } from "./actions";
import { useToast } from "@/components/toaster";

const INIT: AddTaskState = {};

const inputCls =
  "w-full rounded-[--r-md] border border-[--line-1] bg-[--surface-2] px-3 py-2 text-body text-[--ink-1] placeholder:text-[--ink-3] focus:border-[--accent] focus:outline-none [color-scheme:dark]";
const labelCls = "mb-1 block text-caption font-medium text-[--ink-2]";

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
        <div className="rounded-[--r-md] border border-[--warn] bg-[--warn-tint] px-3 py-2">
          <p className="text-caption text-[--warn]">
            Database not connected — set{" "}
            <code className="rounded bg-[--surface-3] px-1">DATABASE_URL</code> to
            save tasks.
          </p>
        </div>
      )}

      <form key={formKey} action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="tqf-subject" className={labelCls}>
            Subject <span className="text-[--bad]">*</span>
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
            <p className="mt-1 text-caption text-[--bad]">
              {state.fieldErrors.subject[0]}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="tqf-due" className={labelCls}>
            Due date <span className="text-[--bad]">*</span>
          </label>
          <input
            id="tqf-due"
            name="dueAt"
            type="date"
            required
            className={`${inputCls} [color-scheme:dark] sm:w-40`}
          />
          {state.fieldErrors?.dueAt && (
            <p className="mt-1 text-caption text-[--bad]">
              {state.fieldErrors.dueAt[0]}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={pending}
          className="tap press inline-flex shrink-0 items-center justify-center rounded-[--r-md] bg-[--accent] px-5 text-body font-medium text-[--accent-ink] hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add task"}
        </button>
      </form>
    </div>
  );
}
