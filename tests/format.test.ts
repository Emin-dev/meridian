import { describe, expect, it } from "vitest";
import {
  formatCurrency,
  formatShortDate,
  numericEqual,
  sumByCurrency,
} from "@/lib/format";

describe("formatCurrency", () => {
  it("formats a whole-dollar amount with no fractional digits", () => {
    expect(formatCurrency(1000)).toBe("$1,000");
  });

  it("rounds away fractional cents (maximumFractionDigits: 0)", () => {
    expect(formatCurrency(1234.56)).toBe("$1,235");
  });

  it("formats zero", () => {
    expect(formatCurrency(0)).toBe("$0");
  });

  it("handles negative amounts", () => {
    expect(formatCurrency(-2500)).toBe("-$2,500");
  });

  it("falls back to zero for non-finite input", () => {
    expect(formatCurrency(NaN)).toBe("$0");
    expect(formatCurrency(Infinity)).toBe("$0");
  });

  it("respects an explicit currency code", () => {
    expect(formatCurrency(1000, "EUR")).toBe("€1,000");
  });
});

describe("formatShortDate", () => {
  it("returns an em dash for null", () => {
    expect(formatShortDate(null)).toBe("—");
  });

  it("formats an ISO date string as 'Mon D, YYYY'", () => {
    // Use a UTC-noon timestamp so the local-date conversion can't slip a day.
    expect(formatShortDate("2026-06-26T12:00:00Z")).toBe("Jun 26, 2026");
  });

  it("formats a Date object", () => {
    expect(formatShortDate(new Date("2026-01-05T12:00:00Z"))).toBe("Jan 5, 2026");
  });
});

describe("sumByCurrency", () => {
  it("groups and sums amounts by currency code", () => {
    expect(
      sumByCurrency([
        { value: 100, currency: "USD" },
        { value: 50, currency: "USD" },
        { value: 200, currency: "EUR" },
      ]),
    ).toEqual({ USD: 150, EUR: 200 });
  });

  it("returns an empty map for an empty list", () => {
    expect(sumByCurrency([])).toEqual({});
  });

  it("skips null, undefined, and non-finite values", () => {
    expect(
      sumByCurrency([
        { value: 100, currency: "USD" },
        { value: null, currency: "USD" },
        { value: undefined, currency: "USD" },
        { value: NaN, currency: "EUR" },
        { value: Infinity, currency: "EUR" },
      ]),
    ).toEqual({ USD: 100 });
  });

  it("does not create a key when every value for a currency is skipped", () => {
    expect(
      sumByCurrency([{ value: NaN, currency: "GBP" }]),
    ).toEqual({});
  });

  it("preserves negative amounts", () => {
    expect(
      sumByCurrency([
        { value: 300, currency: "USD" },
        { value: -100, currency: "USD" },
      ]),
    ).toEqual({ USD: 200 });
  });
});

describe("numericEqual", () => {
  it("treats equivalent decimal representations as equal", () => {
    expect(numericEqual("100", "100.00")).toBe(true);
    expect(numericEqual("0", "0.0")).toBe(true);
  });

  it("distinguishes genuinely different numbers", () => {
    expect(numericEqual("100", "100.01")).toBe(false);
  });

  it("treats two null/undefined sides as equal", () => {
    expect(numericEqual(null, null)).toBe(true);
    expect(numericEqual(undefined, null)).toBe(true);
    expect(numericEqual(undefined, undefined)).toBe(true);
  });

  it("treats one null side as not equal to a value", () => {
    expect(numericEqual(null, "0")).toBe(false);
    expect(numericEqual("5", null)).toBe(false);
  });

  it("falls back to strict string equality when a side is not parseable", () => {
    expect(numericEqual("abc", "abc")).toBe(true);
    expect(numericEqual("abc", "abcd")).toBe(false);
  });
});
