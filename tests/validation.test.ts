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
