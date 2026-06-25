"use client";

import { useActionState, useEffect } from "react";
import { updateContact, deleteContact, type ContactFormState } from "../actions";
import type { Contact } from "@/db/schema";
import { useToast } from "@/components/toaster";

const initialState: ContactFormState = {};

interface Props {
  contact: Contact;
}

export default function EditContactForm({ contact }: Props) {
  const boundUpdate = updateContact.bind(null, contact.id);
  const [state, formAction, pending] = useActionState(boundUpdate, initialState);
  const { toast } = useToast();

  useEffect(() => {
    if (state.success) toast("Contact saved");
    if (state.error) toast(state.error, "error");
  }, [state.success, state.error, toast]);

  async function handleDelete() {
    if (!window.confirm(`Delete "${contact.name}"? This cannot be undone.`)) return;
    await deleteContact(contact.id);
  }

  const inputCls =
    "w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-indigo-500 focus:outline-none";
  const labelCls = "mb-1 block text-xs font-medium text-neutral-400";

  return (
    <form action={formAction} className="space-y-4">
      {/* Name */}
      <div>
        <label htmlFor="ec-name" className={labelCls}>
          Name <span className="text-red-400">*</span>
        </label>
        <input
          id="ec-name"
          name="name"
          type="text"
          required
          defaultValue={contact.name}
          className={inputCls}
        />
        {state.fieldErrors?.name && (
          <p className="mt-1 text-xs text-red-400">{state.fieldErrors.name[0]}</p>
        )}
      </div>

      {/* Email */}
      <div>
        <label htmlFor="ec-email" className={labelCls}>
          Email
        </label>
        <input
          id="ec-email"
          name="email"
          type="email"
          defaultValue={contact.email ?? ""}
          className={inputCls}
        />
        {state.fieldErrors?.email && (
          <p className="mt-1 text-xs text-red-400">{state.fieldErrors.email[0]}</p>
        )}
      </div>

      {/* Phone */}
      <div>
        <label htmlFor="ec-phone" className={labelCls}>
          Phone
        </label>
        <input
          id="ec-phone"
          name="phone"
          type="tel"
          defaultValue={contact.phone ?? ""}
          className={inputCls}
        />
      </div>

      {/* Company + Title */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="ec-company" className={labelCls}>
            Company
          </label>
          <input
            id="ec-company"
            name="company"
            type="text"
            defaultValue={contact.company ?? ""}
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="ec-title" className={labelCls}>
            Title
          </label>
          <input
            id="ec-title"
            name="title"
            type="text"
            defaultValue={contact.title ?? ""}
            className={inputCls}
          />
        </div>
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="ec-notes" className={labelCls}>
          Notes
        </label>
        <textarea
          id="ec-notes"
          name="notes"
          rows={4}
          defaultValue={contact.notes ?? ""}
          className={`${inputCls} resize-none`}
        />
      </div>

      {state.noDb && (
        <p className="text-xs text-red-400">Database not connected — changes cannot be saved.</p>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={handleDelete}
          className="rounded-lg border border-red-800 px-4 py-2 text-sm text-red-400 transition-colors hover:bg-red-900/30 hover:text-red-300"
        >
          Delete contact
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
