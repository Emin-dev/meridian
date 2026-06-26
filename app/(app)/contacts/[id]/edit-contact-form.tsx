"use client";

import { useState, useTransition } from "react";
import { updateContact, deleteContact } from "../actions";
import type { Contact } from "@/db/schema";
import { useToast } from "@/components/toaster";
import TagInput from "../tag-input";
import { SOURCE_LABELS } from "../constants";
import MobileActionSheet from "@/components/mobile-action-sheet";
import type { ContactHeaderUpdate } from "./contact-detail-client";

/** Source picker options (empty = unset), shared by the desktop select and mobile sheet. */
const SOURCE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "— Select —" },
  ...Object.entries(SOURCE_LABELS).map(([value, label]) => ({ value, label })),
];

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
  const [source, setSource] = useState<string>(contact.source ?? "");
  const [sourceSheetOpen, setSourceSheetOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<"name" | "email" | "phone" | "company" | "title" | "notes" | "source" | "owner", string[]>>
  >({});

  const inputCls =
    "tap w-full rounded-lg border border-[var(--line-1)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--ink-1)] placeholder:text-[var(--ink-3)] focus:border-[var(--accent)] focus:outline-none";
  const labelCls = "mb-1 block text-xs font-medium text-[var(--ink-2)]";

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
    <>
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name */}
      <div>
        <label htmlFor="ec-name" className={labelCls}>
          Name <span className="text-[var(--bad)]">*</span>
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
          <p className="mt-1 text-xs text-[var(--bad)]">{fieldErrors.name[0]}</p>
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
          <p className="mt-1 text-xs text-[var(--bad)]">{fieldErrors.email[0]}</p>
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
          {/* Desktop: native select. Hidden on mobile but still submits `source`. */}
          <select
            id="ec-source"
            name="source"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className={`${inputCls} hidden sm:block`}
          >
            {SOURCE_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {/* Mobile: 44px button opening an action sheet instead of a native dropdown. */}
          <button
            type="button"
            onClick={() => setSourceSheetOpen(true)}
            className={`${inputCls} tap flex items-center justify-between gap-2 text-left sm:hidden`}
          >
            <span>{SOURCE_LABELS[source] ?? "— Select —"}</span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0 text-[var(--ink-3)]"
              aria-hidden="true"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
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
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={handleDelete}
          className="tap inline-flex items-center justify-center rounded-lg border border-[var(--bad)]/40 px-4 text-sm text-[var(--bad)] transition-colors hover:bg-[var(--bad-tint)] hover:text-[var(--bad)]"
        >
          Delete contact
        </button>
        <button
          type="submit"
          disabled={pending}
          className="tap inline-flex items-center justify-center rounded-lg bg-[var(--accent)] px-4 text-sm font-medium text-[var(--accent-ink)] transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>

      {/* Mobile: source picker bottom sheet (desktop uses the native select). */}
      <div className="sm:hidden">
        <MobileActionSheet
          open={sourceSheetOpen}
          onClose={() => setSourceSheetOpen(false)}
          title="Source"
        >
          <div className="flex flex-col gap-2">
            {SOURCE_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setSource(value);
                  setSourceSheetOpen(false);
                }}
                aria-pressed={source === value}
                className={`tap flex items-center justify-between rounded-lg px-3 text-left text-body transition-colors ${
                  source === value
                    ? "bg-[var(--surface-3)] text-[var(--ink-1)]"
                    : "text-[var(--ink-2)] hover:bg-[var(--surface-3)]"
                }`}
              >
                <span>{label}</span>
                {source === value && (
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="shrink-0 text-[var(--accent)]"
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
    </>
  );
}
