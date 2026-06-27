import { describe, expect, it } from "vitest";
import { z } from "zod";
import { contactToVars, interpolate, PLACEHOLDER_VARS } from "@/lib/template";
// The single-source-of-truth deal value validator now shared by the create
// (deals/actions.ts) and edit (deals/[id]/actions.ts) flows. It's a pure module
// (no DB/network), so the real schema is imported and exercised directly.
import { dealValueSchema } from "@/app/(app)/deals/value-schema";

describe("deal value validation", () => {
  it.each(["1000", "10.50", "0", "1.5", "999999.99"])(
    "accepts a plain numeric amount: %s",
    (input) => {
      expect(dealValueSchema.safeParse(input).success).toBe(true);
    },
  );

  it.each([
    "1,000",
    "abc",
    "10.500", // over-precision
    "$1000",
    "1.2.3",
    "10.",
    "-5", // negative
    " 100 ",
    "NaN",
    "1e5",
    "Infinity",
  ])("rejects a non-numeric / malformed amount: %s", (input) => {
    expect(dealValueSchema.safeParse(input).success).toBe(false);
  });

  it("treats a missing value as null (optional amount)", () => {
    expect(dealValueSchema.safeParse(null).success).toBe(true);
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

// ── CSV import (bulkImportContacts) ─────────────────────────────────────────
// Mirrors CsvRowSchema in app/(app)/contacts/actions.ts. Kept pure here (no
// DB/network) because that schema lives in a "use server" module. If the rules
// below change, update them there too. These lock the per-row skip reasons and
// the dedup/count accounting so messy CSVs can't silently lose or miscount rows.
const MAX_CSV_NAME_LENGTH = 200;
const MAX_CSV_EMAIL_LENGTH = 320;
const MAX_CSV_FIELD_LENGTH = 500;

const CsvRowSchema = z.object({
  name: z
    .string()
    .transform((v) => v.trim())
    .superRefine((v, ctx) => {
      if (v === "") ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Missing name" });
      else if (v.length > MAX_CSV_NAME_LENGTH)
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Name too long" });
    }),
  email: z
    .string()
    .transform((v) => v.trim().toLowerCase())
    .superRefine((v, ctx) => {
      if (v === "") return;
      if (v.length > MAX_CSV_EMAIL_LENGTH)
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Email too long" });
      else if (!z.string().email().safeParse(v).success)
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid email format" });
    })
    .transform((v) => (v === "" ? null : v)),
  phone: z
    .string()
    .transform((v) => v.trim())
    .transform((v) => (v === "" ? null : v.slice(0, MAX_CSV_FIELD_LENGTH))),
  company: z
    .string()
    .transform((v) => v.trim())
    .transform((v) => (v === "" ? null : v.slice(0, MAX_CSV_FIELD_LENGTH))),
});

describe("CsvRowSchema per-row validation", () => {
  it("accepts a clean row and normalizes email to lowercase + trims fields", () => {
    const parsed = CsvRowSchema.safeParse({
      name: "  Jane Smith ",
      email: "  JANE@Example.COM ",
      phone: "  +1 555 0001 ",
      company: "  Acme Corp ",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toEqual({
        name: "Jane Smith",
        email: "jane@example.com",
        phone: "+1 555 0001",
        company: "Acme Corp",
      });
    }
  });

  it.each(["", "   ", "\t"])("skips a missing/whitespace name: %j", (name) => {
    const parsed = CsvRowSchema.safeParse({ name, email: "x@y.com", phone: "", company: "" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0]?.message).toBe("Missing name");
  });

  it.each(["not-an-email", "jane@", "@example.com", "jane @example.com"])(
    "skips an invalid email with a precise reason: %j",
    (email) => {
      const parsed = CsvRowSchema.safeParse({ name: "Jane", email, phone: "", company: "" });
      expect(parsed.success).toBe(false);
      if (!parsed.success) expect(parsed.error.issues[0]?.message).toBe("Invalid email format");
    },
  );

  it("treats a blank email as null (email is optional)", () => {
    const parsed = CsvRowSchema.safeParse({ name: "Jane", email: "  ", phone: "", company: "" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.email).toBeNull();
  });

  it("skips an over-long name and an over-long email", () => {
    const longName = CsvRowSchema.safeParse({
      name: "a".repeat(MAX_CSV_NAME_LENGTH + 1),
      email: "",
      phone: "",
      company: "",
    });
    expect(longName.success).toBe(false);
    if (!longName.success) expect(longName.error.issues[0]?.message).toBe("Name too long");

    const longEmail = CsvRowSchema.safeParse({
      name: "Jane",
      email: `${"a".repeat(MAX_CSV_EMAIL_LENGTH)}@x.com`,
      phone: "",
      company: "",
    });
    expect(longEmail.success).toBe(false);
    if (!longEmail.success) expect(longEmail.error.issues[0]?.message).toBe("Email too long");
  });
});

// Mirrors the dedup + accounting in bulkImportContacts: every input row ends up
// either imported or skipped exactly once, dups (vs DB and within the batch) are
// rejected case-insensitively, and null-email rows are never deduped.
function planImport(
  rows: { name: string; email: string | null }[],
  existing: string[],
): { imported: number; skipped: number } {
  const existingLower = new Set(existing.map((e) => e.toLowerCase()));
  const seen = new Set<string>();
  let imported = 0;
  let skipped = 0;
  for (const r of rows) {
    if (r.email) {
      const lower = r.email.toLowerCase();
      if (existingLower.has(lower) || seen.has(lower)) {
        skipped++;
        continue;
      }
      seen.add(lower);
    }
    imported++;
  }
  return { imported, skipped };
}

describe("bulkImportContacts dedup + count accounting", () => {
  it("never loses a row: imported + skipped equals the input count", () => {
    const rows = [
      { name: "A", email: "a@x.com" },
      { name: "B", email: "DUP@x.com" },
      { name: "C", email: "dup@x.com" }, // in-batch dup (case-insensitive)
      { name: "D", email: "exists@x.com" }, // already in DB
      { name: "E", email: null }, // no email — always kept
      { name: "F", email: null }, // no email — kept even though identical to E
    ];
    const result = planImport(rows, ["EXISTS@x.com"]);
    expect(result.imported + result.skipped).toBe(rows.length);
    expect(result.imported).toBe(4); // A, B, E, F
    expect(result.skipped).toBe(2); // C (in-batch dup) + D (db dup)
  });

  it("keeps the first occurrence and skips only the later duplicate", () => {
    const result = planImport(
      [
        { name: "first", email: "same@x.com" },
        { name: "second", email: "SAME@x.com" },
      ],
      [],
    );
    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(1);
  });
});

// Mirrors the oversized-paste guard in bulkImportContacts: a paste over the cap
// is rejected outright with a friendly error instead of importing only the
// first N rows and silently dropping the rest.
const MAX_IMPORT_ROWS = 1000;

function isOverCap(rowCount: number): boolean {
  return rowCount > MAX_IMPORT_ROWS;
}

describe("bulkImportContacts oversized-paste cap", () => {
  it.each([0, 1, MAX_IMPORT_ROWS])("accepts %p rows (at or under the cap)", (n) => {
    expect(isOverCap(n)).toBe(false);
  });

  it.each([MAX_IMPORT_ROWS + 1, MAX_IMPORT_ROWS * 50])(
    "rejects %p rows (over the cap)",
    (n) => {
      expect(isOverCap(n)).toBe(true);
    },
  );
});

// ── Global search pagination (searchGlobal) ─────────────────────────────────
// Mirrors clampPage + the limit(window+1)/slice/hasMore detection in
// app/(app)/search/actions.ts. Kept pure here (no DB) because that file is a
// "use server" module. If SEARCH_PAGE_SIZE / SEARCH_MAX_PAGE or the windowing
// rule change, update them there too. These lock the guarantee that no match is
// ever silently dropped: every page is reachable and hasMore is exact.
const SEARCH_PAGE_SIZE = 25;
const SEARCH_MAX_PAGE = 100;

function clampPage(page: number): number {
  if (!Number.isFinite(page)) return 1;
  return Math.min(Math.max(Math.trunc(page), 1), SEARCH_MAX_PAGE);
}

// Models a tab: given the total matches in the DB and the requested page,
// returns how many rows the UI shows and whether "Load more" is offered.
// `fetched` is what the bounded `limit(window + 1)` query would return.
function paginateTab(totalMatches: number, page: number) {
  const window = clampPage(page) * SEARCH_PAGE_SIZE;
  const fetched = Math.min(totalMatches, window + 1);
  const shown = Math.min(fetched, window);
  return { shown, hasMore: fetched > window };
}

describe("searchGlobal page clamping", () => {
  it.each([
    [0, 1],
    [-5, 1],
    [1.9, 1],
    [3, 3],
    [SEARCH_MAX_PAGE + 50, SEARCH_MAX_PAGE],
    [NaN, 1],
    [Infinity, 1],
  ])("clamps page %p to %p", (input, expected) => {
    expect(clampPage(input)).toBe(expected);
  });
});

describe("searchGlobal tab pagination keeps every match reachable", () => {
  it("shows the full window and flags more when matches exceed it", () => {
    const r = paginateTab(60, 1);
    expect(r.shown).toBe(SEARCH_PAGE_SIZE); // 25
    expect(r.hasMore).toBe(true);
  });

  it("grows the window page by page until the last match is reachable", () => {
    expect(paginateTab(60, 2)).toEqual({ shown: 50, hasMore: true });
    // Page 3 window is 75 ≥ 60, so all 60 show and there is nothing more.
    expect(paginateTab(60, 3)).toEqual({ shown: 60, hasMore: false });
  });

  it("never reports more when the window exactly covers all matches", () => {
    expect(paginateTab(25, 1)).toEqual({ shown: 25, hasMore: false });
    expect(paginateTab(50, 2)).toEqual({ shown: 50, hasMore: false });
  });

  it("handles an empty result set", () => {
    expect(paginateTab(0, 1)).toEqual({ shown: 0, hasMore: false });
  });
});
