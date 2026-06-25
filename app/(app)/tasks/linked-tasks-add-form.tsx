"use client";

import { useActionState, useEffect, useState } from "react";
import { addLinkedTask, type AddTaskState } from "./actions";
import { useToast } from "@/components/toaster";

interface Props {
  contactId: number | null;
  dealId: number | null;
}

const INIT: AddTaskState = {};

const inputCls =
  "w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-indigo-500 focus:outline-none";
const labelCls = "mb-1 block text-xs font-medium text-neutral-400";

export default function LinkedTaskAddForm({ contactId, dealId }: Props) {
  const [state, formAction, pending] = useActionState(addLinkedTask, INIT);
  const [formKey, setFormKey] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    if (state.success) {
      setFormKey((k) => k + 1);
      toast("Task added");
    }
    if (state.error) toast(state.error, "error");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success, state.error]);

  const uid = contactId != null ? `c${contactId}` : `d${dealId}`;

  return (
    <form key={formKey} action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <input type="hidden" name="contactId" value={contactId ?? ""} />
      <input type="hidden" name="dealId" value={dealId ?? ""} />

      <div className="flex-1">
        <label htmlFor={`ltf-subject-${uid}`} className={labelCls}>
          New task <span className="text-red-400">*</span>
        </label>
        <input
          id={`ltf-subject-${uid}`}
          name="subject"
          type="text"
          required
          placeholder="Task subject…"
          className={inputCls}
        />
        {state.fieldErrors?.subject && (
          <p className="mt-1 text-xs text-red-400">{state.fieldErrors.subject[0]}</p>
        )}
      </div>

      <div>
        <label htmlFor={`ltf-due-${uid}`} className={labelCls}>
          Due date <span className="text-red-400">*</span>
        </label>
        <input
          id={`ltf-due-${uid}`}
          name="dueAt"
          type="date"
          required
          className={`${inputCls} [color-scheme:dark] sm:w-36`}
        />
        {state.fieldErrors?.dueAt && (
          <p className="mt-1 text-xs text-red-400">{state.fieldErrors.dueAt[0]}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
      >
        {pending ? "Adding…" : "Add"}
      </button>
    </form>
  );
}
