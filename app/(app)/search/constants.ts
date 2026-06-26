// Hard per-entity cap for global search. `ilike('%term%')` can't use an index,
// so an unbounded match-count over a large connected DB is a full sequential
// scan that can blow the Vercel 10s budget. Bounding every query to this many
// rows keeps the work proportional to the cap, not the table size. Totals are
// derived from the capped result set; the UI shows `N+` when a bucket is full.
//
// Lives in its own module (not actions.ts) because that file is `"use server"`
// and may only export async functions.
export const SEARCH_RESULT_LIMIT = 25;
