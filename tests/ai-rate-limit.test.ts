import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// getSession is mocked per-test so we control which user (or anon) the limiter
// keys on. The underlying limiter (lib/rate-limit) keeps a module-level Map, so
// each test uses a distinct userId to avoid cross-test bleed.
const getSession = vi.fn();
vi.mock("@/lib/auth", () => ({
  getSession: () => getSession(),
}));

import { checkAiRateLimit, AI_RATE_LIMIT_MESSAGE } from "@/lib/ai-rate-limit";

let uid = 1000;
const freshUser = () => ({ userId: uid++, email: "u@x.com" });

describe("checkAiRateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    getSession.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows a burst up to the threshold then rate-limits", async () => {
    getSession.mockResolvedValue(freshUser());

    // MAX_FAILS = 5: the first five calls are allowed, the sixth trips the lock.
    for (let i = 0; i < 5; i++) {
      expect(await checkAiRateLimit()).toBeNull();
    }
    expect(await checkAiRateLimit()).toBe(AI_RATE_LIMIT_MESSAGE);
  });

  it("keys separate users into separate buckets", async () => {
    const a = freshUser();
    const b = freshUser();

    getSession.mockResolvedValue(a);
    for (let i = 0; i < 6; i++) await checkAiRateLimit();
    expect(await checkAiRateLimit()).toBe(AI_RATE_LIMIT_MESSAGE);

    // A different user is unaffected by user A's lockout.
    getSession.mockResolvedValue(b);
    expect(await checkAiRateLimit()).toBeNull();
  });

  it("falls back to a shared anon bucket when there is no session", async () => {
    getSession.mockResolvedValue(null);

    for (let i = 0; i < 5; i++) {
      expect(await checkAiRateLimit()).toBeNull();
    }
    expect(await checkAiRateLimit()).toBe(AI_RATE_LIMIT_MESSAGE);
  });
});
