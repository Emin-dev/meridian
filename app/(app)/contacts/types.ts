// Shared types for the contacts route. Kept in a non-page module so client
// components can import them without importing from a Server Component page.

/** Maps a contact id to the ISO timestamp of its most recent activity, or null. */
export type LastContactedMap = Record<number, string | null>;
