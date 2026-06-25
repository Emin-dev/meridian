// Shared types for the deals route. Defined once here so the server page and
// every client component agree on the same shape instead of re-declaring it.

import type { Deal, Contact } from "@/db/schema";

/** A deal joined with its (optional) linked contact, as loaded with `{ with: { contact: true } }`. */
export type DealWithContact = Deal & { contact: Contact | null };
