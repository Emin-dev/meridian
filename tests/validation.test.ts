import { describe, expect, it } from "vitest";
import { z } from "zod";
import { contactToVars, interpolate, PLACEHOLDER_VARS } from "@/lib/template";

// Mirrors the `value` rule of DealSchema in app/(app)/deals/actions.ts.
// Kept pure here (no DB/network) because that schema lives in a "use server"
// module. If the regex below changes, update it there too.
const dealValue = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, "Enter a valid amount")
  .nullable();

describe("deal value validation", () => {
  it.each(["1000", "10.50", "0", "1.5", "999999.99"])(
    "accepts a plain numeric amount: %s",
    (input) => {
      expect(dealValue.safeParse(input).success).toBe(true);
    },
  );

  it.each(["1,000", "abc", "10.500", "$1000", "1.2.3", "10.", "-5", " 100 "])(
    "rejects a non-numeric / malformed amount: %s",
    (input) => {
      expect(dealValue.safeParse(input).success).toBe(false);
    },
  );

  it("treats a missing value as null (optional amount)", () => {
    expect(dealValue.safeParse(null).success).toBe(true);
  });
});

// Mirrors questionSchema / querySchema in app/(app)/ask/actions.ts and
// app/(app)/search/actions.ts. Kept pure here (no DB/network) because those
// schemas live in "use server" modules. If the bound below changes, update it
// in both action files too.
const boundedQuery = z.string().trim().min(1).max(500);

describe("ask/search query length bound", () => {
  it("accepts a normal trimmed query", () => {
    const parsed = boundedQuery.safeParse("  acme deals  ");
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).toBe("acme deals");
  });

  it("accepts a query exactly at the 500-char limit", () => {
    expect(boundedQuery.safeParse("a".repeat(500)).success).toBe(true);
  });

  it.each(["", "   ", "\n\t "])(
    "rejects an empty / whitespace-only query: %j",
    (input) => {
      expect(boundedQuery.safeParse(input).success).toBe(false);
    },
  );

  it("rejects an oversized query (> 500 chars after trim)", () => {
    expect(boundedQuery.safeParse("a".repeat(501)).success).toBe(false);
  });
});

describe("contactToVars with missing fields", () => {
  it("falls back to placeholders when company and owner are absent", () => {
    const vars = contactToVars({ name: "Ada Lovelace", company: null, owner: null });
    expect(vars.firstName).toBe("Ada");
    expect(vars.lastName).toBe("Lovelace");
    expect(vars.company).toBe(PLACEHOLDER_VARS.company);
    expect(vars.ownerName).toBe(PLACEHOLDER_VARS.ownerName);
  });

  it("uses the last-name placeholder when only one name part is given", () => {
    const vars = contactToVars({ name: "Cher", company: "Sony", owner: "Pat" });
    expect(vars.firstName).toBe("Cher");
    expect(vars.lastName).toBe(PLACEHOLDER_VARS.lastName);
    expect(vars.company).toBe("Sony");
    expect(vars.ownerName).toBe("Pat");
  });
});

describe("interpolate leaves placeholders for missing fields", () => {
  it("renders placeholder tokens when a contact lacks a company", () => {
    const vars = contactToVars({ name: "Ada Lovelace", company: null, owner: "Pat" });
    expect(interpolate("Hi {{firstName}} from {{company}}", vars)).toBe(
      `Hi Ada from ${PLACEHOLDER_VARS.company}`,
    );
  });
});
