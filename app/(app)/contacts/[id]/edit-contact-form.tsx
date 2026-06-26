"use client";

import { useState, useTransition } from "react";
import { updateContact, deleteContact } from "../actions";
import type { Contact } from "@/db/schema";
import { useToast } from "@/components/toaster";
import TagInput from "../tag-input";
import type { ContactHeaderUpdate } from "./contact-detail-client";

interface Props {
  contact: Contact;
  /** Called immediately on submit with optimistic header values. */
  onSaved?: (updates: ContactHeaderUpdate) => void;
  /** Called if the server action fails; roll back to this snapshot. */
  onRollback?: (snapshot: Contact) => void;
}

export default function EditContactForm({ contact, onSaved, onRollback }: Props) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<"name" | "email" | "phone" | "company" | "title" | "notes" | "source" | "owner", string[]>>
  >({});

  const inputCls =
    "w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-[--accent] focus:outline-none";
  const labelCls = "mb-1 block text-xs font-medium text-neutral-400";

  async function handleDelete() {
    if (!window.confirm(`Delete "${contact.name}"? This cannot be undone.`)) return;
    try {
      await deleteContact(contact.id);
    } catch (err) {
      // A successful delete redirects (handled by Next internally); only a real
      // DB/FK failure reaches here, so surface it to the user.
      toast(err instanceof Error ? err.message : "Could not delete contact.", "error");
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const snapshot = { ...contact };

    // Parse tags from the hidden JSON input (same as server-side parseTags)
    let parsedTags: string[] = [];
    try {
      const raw = String(formData.get("tags") ?? "[]");
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        parsedTags = arr
          .filter((t): t is string => typeof t === "string")
          .map((t) => t.trim())
          .filter(Boolean);
      }
    } catch {
      parsedTags = contact.tags ?? [];
    }

    // Optimistic update for the page header fields
    const optimistic: ContactHeaderUpdate = {
      name:    String(formData.get("name") ?? "").trim() || contact.name,
      title:   String(formData.get("title") ?? "").trim() || null,
      company: String(formData.get("company") ?? "").trim() || null,
      tags:    parsedTags,
    };
    onSaved?.(optimistic);
    setFieldErrors({});

    startTransition(async () => {
      const result = await updateContact(contact.id, {}, formData);
      if (result.error) {
        onRollback?.(snapshot);
        toast(result.error, "error");
      } else if (result.fieldErrors) {
        onRollback?.(snapshot);
        setFieldErrors(result.fieldErrors);
        toast("Please fix the highlighted errors", "error");
      } else if (result.noDb) {
        onRollback?.(snapshot);
        toast("Database not connected — changes cannot be saved.", "error");
      } else if (result.success) {
        toast("Contact saved");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
        {fieldErrors.name && (
          <p className="mt-1 text-xs text-red-400">{fieldErrors.name[0]}</p>
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
        {fieldErrors.email && (
          <p className="mt-1 text-xs text-red-400">{fieldErrors.email[0]}</p>
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

      {/* Source + Owner */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="ec-source" className={labelCls}>
            Source
          </label>
          <select
            id="ec-source"
            name="source"
            defaultValue={contact.source ?? ""}
            className={inputCls}
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
          <label htmlFor="ec-owner" className={labelCls}>
            Owner
          </label>
          <input
            id="ec-owner"
            name="owner"
            type="text"
            placeholder="Assigned rep"
            defaultValue={contact.owner ?? ""}
            className={inputCls}
          />
        </div>
      </div>

      {/* Preserve notes value when saving other fields */}
      <input type="hidden" name="notes" value={contact.notes ?? ""} readOnly />

      {/* Tags */}
      <div>
        <label className={labelCls}>Tags</label>
        <TagInput name="tags" defaultValue={contact.tags ?? []} />
      </div>

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
          className="rounded-lg bg-[--accent] px-4 py-2 text-sm font-medium text-[--accent-ink] transition-colors hover:bg-[--accent-hover] disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
