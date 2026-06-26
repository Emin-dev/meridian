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

// Hard cap on rows the leading-wildcard `ilike('%term%')` is allowed to scan
// per table. `LIMIT` bounds rows *returned*, not rows *scanned*: a term that
// matches few/no rows still forces Postgres to sequentially scan the WHOLE
// table to satisfy the limit — the worst case for the 10s budget on a large DB.
// So each table's candidate set is first bounded to the newest SEARCH_SCAN_ROW_CAP
// rows (via the `id` PK index, cheap), and the ilike filter runs over that bounded
// set. This makes scan cost constant regardless of table size. The trade-off is
// that search covers the most recent SEARCH_SCAN_ROW_CAP records per table; it is
// set far above the largest reachable page window (SEARCH_MAX_PAGE * PAGE_SIZE)
// so paging never outruns the searchable set under normal data volumes.
export const SEARCH_SCAN_ROW_CAP = 20000;
