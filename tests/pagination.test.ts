import { describe, expect, it } from "vitest";
// Pure module (no DB/network): the shared "load more" window helpers used by the
// contacts/deals/tasks list pages. Exercised directly.
import { resolvePageWindow, slicePageWindow } from "@/lib/pagination";

const cfg = { pageSize: 50, maxPage: 100 };

describe("resolvePageWindow", () => {
  it("defaults a missing param to page 1", () => {
    expect(resolvePageWindow(undefined, cfg)).toEqual({
      pageNum: 1,
      windowSize: 50,
      fetchLimit: 51,
    });
  });

  it.each(["", "abc", "0", "-3"])(
    "clamps a non-numeric / sub-1 param to page 1: %s",
    (input) => {
      expect(resolvePageWindow(input, cfg).pageNum).toBe(1);
    },
  );

  it("grows the window by pageSize per page and over-fetches by one", () => {
    const w = resolvePageWindow("3", cfg);
    expect(w).toEqual({ pageNum: 3, windowSize: 150, fetchLimit: 151 });
  });

  it("clamps an out-of-range page to maxPage", () => {
    const w = resolvePageWindow("99999", cfg);
    expect(w.pageNum).toBe(100);
    expect(w.windowSize).toBe(5000);
    expect(w.fetchLimit).toBe(5001);
  });

  it("respects a different pageSize/maxPage (deals config)", () => {
    expect(resolvePageWindow("2", { pageSize: 100, maxPage: 50 })).toEqual({
      pageNum: 2,
      windowSize: 200,
      fetchLimit: 201,
    });
  });
});

describe("slicePageWindow", () => {
  it("reports hasMore and trims the extra detection row", () => {
    const rows = Array.from({ length: 51 }, (_, i) => i);
    const sliced = slicePageWindow(rows, 50);
    expect(sliced.hasMore).toBe(true);
    expect(sliced.rows).toHaveLength(50);
    expect(sliced.rows[49]).toBe(49);
  });

  it("reports no more page when the window is not filled past size", () => {
    const rows = Array.from({ length: 30 }, (_, i) => i);
    const sliced = slicePageWindow(rows, 50);
    expect(sliced.hasMore).toBe(false);
    expect(sliced.rows).toHaveLength(30);
  });

  it("reports no more page on an exactly-full window", () => {
    const rows = Array.from({ length: 50 }, (_, i) => i);
    const sliced = slicePageWindow(rows, 50);
    expect(sliced.hasMore).toBe(false);
    expect(sliced.rows).toHaveLength(50);
  });
});
