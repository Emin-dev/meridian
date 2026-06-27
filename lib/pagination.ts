/**
 * Shared "load more" window pagination.
 *
 * The contacts, deals and tasks list pages all grow a visible window one
 * PAGE_SIZE at a time via a `page` URL param, fetching one extra row
 * (`fetchLimit`) to detect whether a further page exists without paying for a
 * second count query. That parse-and-clamp + slice logic was duplicated across
 * all three (with subtly different PAGE_SIZE/MAX_PAGE constants); these two pure
 * helpers centralize it.
 */

export interface PageWindowConfig {
  /** Rows per page step. */
  pageSize: number;
  /** Hard cap on pageNum so a request never triggers an unbounded scan. */
  maxPage: number;
}

export interface PageWindow {
  /** Clamped page number, in [1, maxPage]. */
  pageNum: number;
  /** Total visible rows for this page = pageNum * pageSize. */
  windowSize: number;
  /** DB limit to request: windowSize + 1 (the extra row detects hasMore). */
  fetchLimit: number;
}

/**
 * Parse and clamp a `page` URL param into a bounded visible window. A missing
 * or non-numeric param resolves to page 1; out-of-range values clamp to
 * [1, maxPage].
 */
export function resolvePageWindow(
  pageParam: string | undefined,
  { pageSize, maxPage }: PageWindowConfig,
): PageWindow {
  const parsed =
    pageParam && !isNaN(parseInt(pageParam)) ? parseInt(pageParam) : 1;
  const pageNum = Math.min(Math.max(parsed, 1), maxPage);
  const windowSize = pageNum * pageSize;
  return { pageNum, windowSize, fetchLimit: windowSize + 1 };
}

export interface SlicedPage<T> {
  /** The visible rows, trimmed to windowSize. */
  rows: T[];
  /** Whether a further page exists (the extra detection row was returned). */
  hasMore: boolean;
}

/**
 * Trim the over-fetched rows (windowSize + 1) down to the visible window and
 * derive `hasMore` from whether the extra detection row came back.
 */
export function slicePageWindow<T>(
  rows: T[],
  windowSize: number,
): SlicedPage<T> {
  const hasMore = rows.length > windowSize;
  return { rows: hasMore ? rows.slice(0, windowSize) : rows, hasMore };
}
