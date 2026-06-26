"use client";

import { useActionState, useEffect, useState } from "react";
import { addActivity, type AddActivityState } from "./actions";
import { useToast } from "@/components/toaster";
import SmartCompose from "@/components/smart-compose";
import MobileActionSheet from "@/components/mobile-action-sheet";

const INIT: AddActivityState = {};
const ACTIVITY_TYPES = ["call", "email", "meeting", "note", "task"] as const;

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const inputCls =
  "w-full rounded-[--r-md] border border-[--line-1] bg-[--surface-2] px-3 py-2 text-body text-[--ink-1] placeholder:text-[--ink-3] focus:border-[--accent] focus:outline-none [color-scheme:dark]";
const labelCls = "mb-1 block text-caption font-medium text-[--ink-2]";

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
  const [type, setType] = useState<string>("note");
  const [typeSheetOpen, setTypeSheetOpen] = useState(false);
  const [body, setBody] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (state.success) {
      setFormKey((k) => k + 1);
      setBody("");
      toast("Activity logged");
      onSuccess?.();
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
          {/* Type picker — w-full on mobile so it fills the stacked column */}
          <div className="w-full sm:w-auto">
            <label htmlFor="af-type" className={labelCls}>
              Type
            </label>
            {/* Desktop: native select. Hidden (display:none) on mobile but still
                submits `type` as the form's single source of truth. */}
            <select
              id="af-type"
              name="type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className={`${inputCls} hidden sm:block`}
            >
              {ACTIVITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {cap(t)}
                </option>
              ))}
            </select>
            {/* Mobile: 44px button opening an action sheet instead of a native dropdown. */}
            <button
              type="button"
              onClick={() => setTypeSheetOpen(true)}
              className={`${inputCls} tap flex items-center justify-between gap-2 text-left sm:hidden`}
            >
              <span>{cap(type)}</span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="shrink-0 text-[--ink-3]"
                aria-hidden="true"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
          </div>

          <div className="flex-1">
            <label htmlFor="af-subject" className={labelCls}>
              Subject <span className="text-[--bad]">*</span>
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
              <p className="mt-1 text-caption text-[--bad]">
                {state.fieldErrors.subject[0]}
              </p>
            )}
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-end justify-between gap-3">
            <label htmlFor="af-body" className={labelCls + " mb-0"}>
              Notes
            </label>
            <SmartCompose type={type} onAccept={setBody} />
          </div>
          <textarea
            id="af-body"
            name="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
            placeholder="Optional details..."
            className={`${inputCls} resize-none`}
          />
        </div>

        <div>
          <label htmlFor="af-due" className={labelCls}>
            Due date <span className="text-[--ink-3]">(optional)</span>
          </label>
          <input
            id="af-due"
            name="dueAt"
            type="date"
            className={`${inputCls} [color-scheme:dark]`}
          />
        </div>

        <div className="flex items-center gap-3">
          <input
            id="af-completed"
            name="completedAt"
            type="checkbox"
            className="h-4 w-4 rounded border-[--line-2] bg-[--surface-2] accent-[--accent]"
          />
          <label
            htmlFor="af-completed"
            className="text-caption text-[--ink-2] cursor-pointer select-none"
          >
            Mark as completed
          </label>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={pending}
            className="tap press inline-flex items-center justify-center rounded-[--r-md] bg-[--accent] px-5 text-body font-medium text-[--accent-ink] hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Logging…" : "Log activity"}
          </button>
        </div>
      </form>

      {/* Mobile: activity-type picker bottom sheet (desktop uses the native select). */}
      <div className="sm:hidden">
        <MobileActionSheet
          open={typeSheetOpen}
          onClose={() => setTypeSheetOpen(false)}
          title="Activity type"
        >
          <div className="flex flex-col gap-2">
            {ACTIVITY_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setType(t);
                  setTypeSheetOpen(false);
                }}
                aria-pressed={type === t}
                className={`tap flex items-center justify-between rounded-lg px-3 text-left text-body transition-colors ${
                  type === t
                    ? "bg-[--surface-3] text-[--ink-1]"
                    : "text-[--ink-2] hover:bg-[--surface-3]"
                }`}
              >
                <span>{cap(t)}</span>
                {type === t && (
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="shrink-0 text-[--accent]"
                    aria-hidden="true"
                  >
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </MobileActionSheet>
      </div>
    </div>
  );
}
