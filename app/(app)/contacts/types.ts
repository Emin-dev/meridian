// Shared types for the contacts route. Kept in a non-page module so client
// components can import them without importing from a Server Component page.

import type { Contact } from "@/db/schema";

/** Maps a contact id to the ISO timestamp of its most recent activity, or null. */
export type LastContactedMap = Record<number, string | null>;

/**
 * The subset of contact columns actually rendered in the list table/cards.
 * The list query selects only these to avoid shipping large unused text
 * fields (notes, aiSummary, leadScoreRationale, …) on every page load.
 */
export type ContactListItem = Pick<
  Contact,
  | "id"
  | "name"
  | "email"
  | "phone"
  | "company"
  | "title"
  | "status"
  | "source"
  | "owner"
  | "tags"
  | "leadScore"
  | "createdAt"
>;
