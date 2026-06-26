import { describe, expect, it } from "vitest";
import {
  BULK_SCORE_BATCH,
  BULK_SCORE_CONCURRENCY,
  BULK_SCORE_DEADLINE_MS,
  summarizeBulkScore,
} from "@/lib/bulk-score";

describe("bulk-score bounds", () => {
  it("caps each invocation to a small slice that stays under the 10s limit", () => {
    // The slice must be small enough that, at the chosen concurrency, the batch
    // can't realistically exceed Vercel's 10s request limit.
    expect(BULK_SCORE_BATCH).toBeLessThanOrEqual(8);
    expect(BULK_SCORE_BATCH).toBeGreaterThan(0);
    expect(BULK_SCORE_CONCURRENCY).toBeGreaterThan(0);
    expect(BULK_SCORE_CONCURRENCY).toBeLessThanOrEqual(BULK_SCORE_BATCH);
    // Soft deadline leaves headroom under the 10s hard limit for the final write.
    expect(BULK_SCORE_DEADLINE_MS).toBeLessThan(10_000);
  });
});

describe("summarizeBulkScore", () => {
  it("reports all attempted contacts scored when none failed", () => {
    expect(summarizeBulkScore(20, 8, 0)).toEqual({
      count: 8,
      failed: 0,
      remaining: 12,
    });
  });

  it("counts unscored attempted contacts as failed, not as scored", () => {
    expect(summarizeBulkScore(20, 8, 3)).toEqual({
      count: 5,
      failed: 3,
      remaining: 15,
    });
  });

  it("folds deadline-skipped (un-attempted) contacts into remaining only", () => {
    // 20 unscored, but only 4 attempted (deadline hit), all 4 scored: 16 remain.
    expect(summarizeBulkScore(20, 4, 0)).toEqual({
      count: 4,
      failed: 0,
      remaining: 16,
    });
  });

  it("returns a fully-remaining tally when nothing was attempted", () => {
    expect(summarizeBulkScore(20, 0, 0)).toEqual({
      count: 0,
      failed: 0,
      remaining: 20,
    });
  });

  it("never reports negative figures from stale or over-counted inputs", () => {
    // failedAmongAttempted can never exceed attempted; remaining never < 0.
    expect(summarizeBulkScore(0, 5, 9)).toEqual({
      count: 0,
      failed: 5,
      remaining: 0,
    });
  });

  it("clamps and truncates non-integer / negative inputs defensively", () => {
    expect(summarizeBulkScore(-3, -2, -1)).toEqual({
      count: 0,
      failed: 0,
      remaining: 0,
    });
    expect(summarizeBulkScore(10.9, 3.9, 1.9)).toEqual({
      count: 2,
      failed: 1,
      remaining: 8,
    });
  });

  it("remaining accounts only for scored, so failures stay re-runnable", () => {
    // 8 attempted, 8 failed → 0 scored → all 50 still remaining.
    expect(summarizeBulkScore(50, 8, 8)).toEqual({
      count: 0,
      failed: 8,
      remaining: 50,
    });
  });
});
