"use client";

import { useActionState, useEffect, useRef } from "react";
import { createContact, type ContactFormState } from "./actions";
import { useToast } from "@/components/toaster";
import TagInput from "./tag-input";

const initialState: ContactFormState = {};

interface Props {
  hasDb: boolean;
}

export default function NewContactModal({ hasDb }: Props) {
  const [state, formAction, pending] = useActionState(createContact, initialState);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (state.success) {
      dialogRef.current?.close();
      formRef.current?.reset();
      toast("Contact created");
    }
    if (state.error) toast(state.error, "error");
  }, [state.success, state.error, toast]);

  const noDb = !hasDb || state.noDb;

  const openModal = () => {
    // Never let two modals stack/overlap: close any other open dialog first.
    document
      .querySelectorAll("dialog[open]")
      .forEach((d) => (d as HTMLDialogElement).close());
    dialogRef.current?.showModal();
  };

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="rounded-lg bg-[--accent] px-4 py-2 text-sm font-medium text-[--accent-ink] transition-colors hover:bg-[--accent-hover]"
      >
        New contact
      </button>

      {/*
        Mobile: bottom sheet — pinned inset-x-0 bottom-0, rounded top corners, full width.
        Desktop (sm:): centered modal — restore UA inset-0 + m-auto centering, max-w-lg.
      */}
      <dialog
        ref={dialogRef}
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current?.close();
        }}
        className="
          m-0 inset-x-0 bottom-0 top-auto
          w-full max-w-none rounded-t-[var(--r-2xl)]
          max-h-[90dvh] overflow-hidden flex flex-col
          border border-[var(--line-1)] bg-[var(--surface-1)] p-0 text-[var(--ink-1)] shadow-2xl
          backdrop:bg-black/60
          sm:m-auto sm:inset-0 sm:max-w-lg sm:w-full sm:rounded-xl
        "
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between border-b border-[var(--line-1)] px-6 py-4">
          <h2 className="text-base font-semibold">New Contact</h2>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="tap flex items-center justify-center rounded-lg text-[var(--ink-2)] hover:bg-[var(--surface-2)] hover:text-[var(--ink-1)] transition-colors"
            aria-label="Close"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* No-DB state */}
        {noDb ? (
          <div className="flex-1 overflow-y-auto space-y-2 px-6 py-10 text-center">
            <p className="text-sm text-[var(--ink-2)]">Database not connected.</p>
            <p className="text-xs text-[var(--ink-3)]">
              Set{" "}
              <code className="rounded bg-[var(--surface-2)] px-1 py-0.5">
                DATABASE_URL
              </code>{" "}
              to save contacts to your Neon database.
            </p>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="mt-4 rounded-lg bg-[var(--surface-2)] px-4 py-2 text-sm text-[var(--ink-2)] hover:bg-[var(--surface-3)]"
            >
              Close
            </button>
          </div>
        ) : (
          /* Form: flex column so body scrolls and footer sticks */
          <form
            ref={formRef}
            action={formAction}
            className="flex flex-col flex-1 min-h-0"
          >
            {/* Scrollable fields */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {/* Name */}
              <div>
                <label
                  htmlFor="nc-name"
                  className="mb-1 block text-xs font-medium text-[var(--ink-2)]"
                >
                  Name <span className="text-[var(--bad)]">*</span>
                </label>
                <input
                  id="nc-name"
                  name="name"
                  type="text"
                  required
                  placeholder="Jane Smith"
                  className="w-full rounded-lg border border-[var(--line-1)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--ink-1)] placeholder-[var(--ink-3)] focus:border-[--accent] focus:outline-none"
                />
                {state.fieldErrors?.name && (
                  <p className="mt-1 text-xs text-[var(--bad)]">
                    {state.fieldErrors.name[0]}
                  </p>
                )}
              </div>

              {/* Email */}
              <div>
                <label
                  htmlFor="nc-email"
                  className="mb-1 block text-xs font-medium text-[var(--ink-2)]"
                >
                  Email
                </label>
                <input
                  id="nc-email"
                  name="email"
                  type="email"
                  placeholder="jane@example.com"
                  className="w-full rounded-lg border border-[var(--line-1)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--ink-1)] placeholder-[var(--ink-3)] focus:border-[--accent] focus:outline-none"
                />
                {state.fieldErrors?.email && (
                  <p className="mt-1 text-xs text-[var(--bad)]">
                    {state.fieldErrors.email[0]}
                  </p>
                )}
              </div>

              {/* Phone */}
              <div>
                <label
                  htmlFor="nc-phone"
                  className="mb-1 block text-xs font-medium text-[var(--ink-2)]"
                >
                  Phone
                </label>
                <input
                  id="nc-phone"
                  name="phone"
                  type="tel"
                  placeholder="+1 555 000 0000"
                  className="w-full rounded-lg border border-[var(--line-1)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--ink-1)] placeholder-[var(--ink-3)] focus:border-[--accent] focus:outline-none"
                />
              </div>

              {/* Company + Title */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="nc-company"
                    className="mb-1 block text-xs font-medium text-[var(--ink-2)]"
                  >
                    Company
                  </label>
                  <input
                    id="nc-company"
                    name="company"
                    type="text"
                    placeholder="Acme Corp"
                    className="w-full rounded-lg border border-[var(--line-1)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--ink-1)] placeholder-[var(--ink-3)] focus:border-[--accent] focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="nc-title"
                    className="mb-1 block text-xs font-medium text-[var(--ink-2)]"
                  >
                    Title
                  </label>
                  <input
                    id="nc-title"
                    name="title"
                    type="text"
                    placeholder="VP Sales"
                    className="w-full rounded-lg border border-[var(--line-1)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--ink-1)] placeholder-[var(--ink-3)] focus:border-[--accent] focus:outline-none"
                  />
                </div>
              </div>

              {/* Source + Owner */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="nc-source"
                    className="mb-1 block text-xs font-medium text-[var(--ink-2)]"
                  >
                    Source
                  </label>
                  <select
                    id="nc-source"
                    name="source"
                    className="w-full rounded-lg border border-[var(--line-1)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--ink-1)] focus:border-[--accent] focus:outline-none"
                  >
                    <option value="">— Select —</option>
                    <option value="website">Website</option>
                    <option value="referral">Referral</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="cold-outreach">Cold Outreach</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="nc-owner"
                    className="mb-1 block text-xs font-medium text-[var(--ink-2)]"
                  >
                    Owner
                  </label>
                  <input
                    id="nc-owner"
                    name="owner"
                    type="text"
                    placeholder="Assigned rep"
                    className="w-full rounded-lg border border-[var(--line-1)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--ink-1)] placeholder-[var(--ink-3)] focus:border-[--accent] focus:outline-none"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label
                  htmlFor="nc-notes"
                  className="mb-1 block text-xs font-medium text-[var(--ink-2)]"
                >
                  Notes
                </label>
                <textarea
                  id="nc-notes"
                  name="notes"
                  rows={3}
                  placeholder="Any notes about this contact…"
                  className="w-full resize-none rounded-lg border border-[var(--line-1)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--ink-1)] placeholder-[var(--ink-3)] focus:border-[--accent] focus:outline-none"
                />
              </div>

              {/* Tags */}
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--ink-2)]">
                  Tags
                </label>
                <TagInput name="tags" />
              </div>

              {state.error && (
                <p className="text-xs text-[var(--bad)]">{state.error}</p>
              )}
            </div>

            {/* Sticky footer — pb absorbs iOS home indicator */}
            <div className="shrink-0 flex justify-end gap-3 border-t border-[var(--line-1)] px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                className="rounded-lg px-4 py-2 text-sm text-[var(--ink-2)] hover:bg-[var(--surface-2)] hover:text-[var(--ink-1)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-[--accent] px-4 py-2 text-sm font-medium text-[--accent-ink] transition-colors hover:bg-[--accent-hover] disabled:opacity-50"
              >
                {pending ? "Saving…" : "Save contact"}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
