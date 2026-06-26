import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkRateLimit,
  recordFailure,
  recordSuccess,
} from "@/lib/rate-limit";

// Module-level Map persists across tests, so each test uses a unique key.
let n = 0;
const freshKey = () => `test-key-${n++}`;

describe("rate-limit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows attempts on an unseen key", () => {
    expect(checkRateLimit(freshKey())).toEqual({
      allowed: true,
      retryAfterMs: 0,
    });
  });

  it("stays allowed up to the failure threshold, then locks out", () => {
    const key = freshKey();
    // 4 failures are below the threshold (MAX_FAILS = 5) — still allowed.
    for (let i = 0; i < 4; i++) recordFailure(key);
    expect(checkRateLimit(key).allowed).toBe(true);

    // 5th failure triggers a lockout with a positive backoff.
    recordFailure(key);
    const res = checkRateLimit(key);
    expect(res.allowed).toBe(false);
    expect(res.retryAfterMs).toBeGreaterThan(0);
  });

  it("applies exponential backoff on repeated failures", () => {
    const key = freshKey();
    for (let i = 0; i < 5; i++) recordFailure(key);
    const first = checkRateLimit(key).retryAfterMs;
    recordFailure(key); // one over the threshold doubles the lock
    const second = checkRateLimit(key).retryAfterMs;
    expect(second).toBeGreaterThan(first);
  });

  it("clears the lockout once the backoff elapses", () => {
    const key = freshKey();
    for (let i = 0; i < 5; i++) recordFailure(key);
    expect(checkRateLimit(key).allowed).toBe(false);

    vi.setSystemTime(20 * 60_000); // past the max 15-min lock window
    expect(checkRateLimit(key).allowed).toBe(true);
  });

  it("recordSuccess resets the counter immediately", () => {
    const key = freshKey();
    for (let i = 0; i < 5; i++) recordFailure(key);
    expect(checkRateLimit(key).allowed).toBe(false);

    recordSuccess(key);
    expect(checkRateLimit(key)).toEqual({ allowed: true, retryAfterMs: 0 });
  });
});
