// Pure helpers for the bulkScoreContacts server action, kept out of the
// "use server" module so the bounding/tally math can be unit-tested without a
// database or the DeepSeek service (a "use server" file may only export async
// server actions, so non-async helpers must live here).

// Cap each bulkScoreContacts invocation to a small slice so the action stays
// well under Vercel's 10s request limit even when individual DeepSeek calls run
// close to their full timeout. Contacts beyond the slice are reported back via
// `remaining` so the user can re-run to continue.
export const BULK_SCORE_BATCH = 8;

// Number of contacts scored concurrently within a slice. Keeping this small is
// gentle on the DeepSeek API while still finishing far faster than a serial
// loop. With BULK_SCORE_BATCH=8 this is at most two concurrent waves.
export const BULK_SCORE_CONCURRENCY = 4;

// Soft wall-clock budget for a single invocation: once exceeded, workers stop
// *starting* new scoring calls (any in-flight call still finishes). This keeps a
// slow batch from compounding wave-on-wave past the 10s limit. Conservative so
// that one extra in-flight call still lands the response under 10s.
export const BULK_SCORE_DEADLINE_MS = 7_500;

export type BulkScoreTally = { count: number; failed: number; remaining: number };

// Derive the BulkScoreState tally from a run's outcome:
// - `count`     = attempted contacts whose leadScore actually persisted
// - `failed`    = attempted contacts still unscored (AI error or no-op write)
// - `remaining` = every unscored contact not scored this run, including ones the
//                 deadline skipped, so the user knows how many re-runs are left.
// Inputs are clamped defensively so a stale/over-counted figure can never yield
// a negative tally.
export function summarizeBulkScore(
  totalUnscored: number,
  attempted: number,
  failedAmongAttempted: number
): BulkScoreTally {
  const safeTotal = Math.max(0, Math.trunc(totalUnscored) || 0);
  const safeAttempted = Math.max(0, Math.trunc(attempted) || 0);
  const failed = Math.min(safeAttempted, Math.max(0, Math.trunc(failedAmongAttempted) || 0));
  const count = safeAttempted - failed;
  const remaining = Math.max(0, safeTotal - count);
  return { count, failed, remaining };
}
