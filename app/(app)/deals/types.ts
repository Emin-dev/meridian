// Shared types for the deals route. Defined once here so the server page and
// every client component agree on the same shape instead of re-declaring it.

import type { Deal, Contact } from "@/db/schema";

/** A deal joined with its (optional) linked contact, as loaded with `{ with: { contact: true } }`. */
export type DealWithContact = Deal & { contact: Contact | null };

/**
 * The trimmed deal shape the list views (kanban board/cards + table) actually
 * render. The deals list query selects only these columns — and only `id`/`name`
 * off the joined contact — so a 200-row page never ships unused heavy text fields
 * (deal `aiSummary`/`closeReason`, the entire Contact record, etc.). Keep this in
 * sync with the `columns` selection in `page.tsx`.
 */
export type DealListItem = Pick<
  Deal,
  | "id"
  | "title"
  | "stage"
  | "value"
  | "currency"
  | "probability"
  | "contactId"
  | "expectedCloseDate"
  | "owner"
  | "notes"
  | "createdAt"
> & { contact: Pick<Contact, "id" | "name"> | null };
