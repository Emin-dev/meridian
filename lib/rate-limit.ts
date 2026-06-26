// Lightweight in-memory rate limiter for auth endpoints.
// Per-instance (serverless) by design — bounds brute-force / credential-stuffing
// against the login action without a new runtime dependency. For a shared store
// across instances, swap the Map for Upstash with the same API.

type Entry = { fails: number; lockedUntil: number; lastSeen: number };

const attempts = new Map<string, Entry>();

const MAX_FAILS = 5; // failures allowed before the first lockout
const BASE_LOCK_MS = 30_000; // 30s, doubles each subsequent failure
const MAX_LOCK_MS = 15 * 60_000; // cap at 15 min
const WINDOW_MS = 15 * 60_000; // stale counters reset after this idle window
const MAX_ENTRIES = 5000; // bound memory; prune when exceeded

function prune(now: number) {
  if (attempts.size < MAX_ENTRIES) return;
  for (const [key, entry] of attempts) {
    if (entry.lockedUntil < now && now - entry.lastSeen > WINDOW_MS) {
      attempts.delete(key);
    }
  }
}

export type RateLimitResult = { allowed: boolean; retryAfterMs: number };

export function checkRateLimit(key: string): RateLimitResult {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry) return { allowed: true, retryAfterMs: 0 };

  // Drop stale counters so a single old failure doesn't linger forever.
  if (now - entry.lastSeen > WINDOW_MS && entry.lockedUntil < now) {
    attempts.delete(key);
    return { allowed: true, retryAfterMs: 0 };
  }

  if (entry.lockedUntil > now) {
    return { allowed: false, retryAfterMs: entry.lockedUntil - now };
  }
  return { allowed: true, retryAfterMs: 0 };
}

export function recordFailure(key: string): void {
  const now = Date.now();
  prune(now);

  const entry = attempts.get(key) ?? { fails: 0, lockedUntil: 0, lastSeen: now };

  // Reset a stale window before counting this failure.
  if (now - entry.lastSeen > WINDOW_MS && entry.lockedUntil < now) {
    entry.fails = 0;
    entry.lockedUntil = 0;
  }

  entry.fails += 1;
  entry.lastSeen = now;

  if (entry.fails >= MAX_FAILS) {
    const over = entry.fails - MAX_FAILS;
    const lock = Math.min(BASE_LOCK_MS * 2 ** over, MAX_LOCK_MS);
    entry.lockedUntil = now + lock;
  }

  attempts.set(key, entry);
}

export function recordSuccess(key: string): void {
  attempts.delete(key);
}
