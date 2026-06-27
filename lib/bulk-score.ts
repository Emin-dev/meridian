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
// slow batch from compounding wave-on-wave past the 10s limit.
//
// The deadline only stops *launching*; the worst-case tail latency is
// (deadline + BULK_SCORE_CALL_TIMEOUT_MS) — a full wave of up to
// BULK_SCORE_CONCURRENCY calls can be launched at the deadline and each run its
// whole per-call timeout. With deadline 4000 + per-call 4000 that wave resolves
// by ~8000ms, leaving ~2s for the trailing count(*) round-trip + revalidatePath
// so the action lands comfortably under Vercel's 10s hard limit even when
// DeepSeek is at its slowest. (In the common fast case calls return in 1–3s, so
// both waves of an 8-contact batch still complete well before the deadline.)
export const BULK_SCORE_DEADLINE_MS = 4_000;

// Per-call AI timeout for the bulk path, deliberately tighter than lib/ai.ts's
// 9s global ceiling so a single near-timeout scoring call can't consume the
// entire remaining request budget. A scored lead is a small flash JSON response
// that normally returns in 1–3s; calls that exceed this are aborted and the
// contact is reported as unscored (re-picked on the next run) rather than
// risking the whole action being killed mid-flight with its AI spend wasted.
export const BULK_SCORE_CALL_TIMEOUT_MS = 4_000;

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
