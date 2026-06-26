// Per-tab page size for global search. `ilike('%term%')` can't use an index,
// so an unbounded match-count over a large connected DB is a full sequential
// scan that can blow the Vercel 10s budget. Each tab fetches at most
// `page * SEARCH_PAGE_SIZE` rows (+1 to detect a further page), so work stays
// proportional to what's actually been requested, not to the table size.
// "Load more" grows a tab's window one page at a time, keeping every match
// reachable without ever issuing an un-paginated scan.
//
// Lives in its own module (not actions.ts) because that file is `"use server"`
// and may only export async functions.
export const SEARCH_PAGE_SIZE = 25;

// Hard ceiling on how far "Load more" can page, mirroring the contacts/deals
// MAX_PAGE guard so a crafted `?cp=` value can't request an unbounded window.
export const SEARCH_MAX_PAGE = 100;
