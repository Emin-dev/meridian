"use server";

import { z } from "zod";
import { eq, inArray, count, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/require-session";
import type { ImportSkippedRow } from "@/lib/csv";
import {
  WIN_LOSS_MARKER,
  extractUserNotes,
  extractWinLossInsight,
} from "./[id]/notes-utils";
import { DEAL_STAGES, STAGE_PROBABILITY } from "./stages";
import { numericEqual } from "@/lib/format";
import { VALID_CURRENCIES } from "@/lib/currencies";
import { dealValueSchema } from "./value-schema";

const idSchema = z.coerce.number().int().positive();

const DealSchema = z.object({
  title: z.string().min(1, "Title is required"),
  stage: z.enum(DEAL_STAGES),
  value: dealValueSchema,
  currency: z.enum(VALID_CURRENCIES),
  expectedCloseDate: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), "Enter a valid date")
    .nullable(),
  contactId: z
    .number()
    .int("Enter a valid contact")
    .positive("Enter a valid contact")
    .nullable(),
  notes: z.string().nullable(),
  owner: z.string().transform((v) => (v === "" ? null : v)),
});

// Guard change-log rows before they hit the dealEvents table: the field must be
// one of the tracked columns and values are nullable strings. Validating here
// turns a bad field name / malformed value into a clear, surfaced error instead
// of a silent failure inside the surrounding catch.
const DealEventSchema = z.object({
  dealId: z.number().int().positive(),
  field: z.enum(["stage", "value", "probability"]),
  oldValue: z.string().nullable(),
  newValue: z.string().nullable(),
});

export type DealFormState = {
  error?: string;
  fieldErrors?: Partial<
    Record<
      | "title"
      | "stage"
      | "value"
      | "currency"
      | "expectedCloseDate"
      | "contactId"
      | "notes"
      | "owner",
      string[]
    >
  >;
  success?: boolean;
  noDb?: boolean;
};

function parseFormData(formData: FormData) {
  const valueRaw = String(formData.get("value") ?? "").trim();
  const dateRaw = String(formData.get("expectedCloseDate") ?? "").trim();
  const contactIdRaw = String(formData.get("contactId") ?? "").trim();
  const notesRaw = String(formData.get("notes") ?? "").trim();
  const currencyRaw = String(formData.get("currency") ?? "USD").trim();

  return {
    title: String(formData.get("title") ?? "").trim(),
    stage: String(formData.get("stage") ?? "lead"),
    value: valueRaw === "" ? null : valueRaw,
    currency: currencyRaw === "" ? "USD" : currencyRaw,
    expectedCloseDate: dateRaw === "" ? null : dateRaw,
    contactId: contactIdRaw === "" ? null : parseInt(contactIdRaw, 10),
    notes: notesRaw === "" ? null : notesRaw,
    owner: String(formData.get("owner") ?? "").trim(),
  };
}

export async function createDeal(
  _prev: DealFormState,
  formData: FormData
): Promise<DealFormState> {
  await requireSession();

  const raw = parseFormData(formData);
  const parsed = DealSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten()
        .fieldErrors as DealFormState["fieldErrors"],
    };
  }

  const db = getDb();
  if (!db) return { noDb: true };

  const { title, stage, value, currency, expectedCloseDate, contactId, notes, owner } =
    parsed.data;

  try {
    await db.insert(schema.deals).values({
      title,
      stage,
      value: value ?? undefined,
      currency,
      probability: STAGE_PROBABILITY[stage] ?? 10,
      expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : undefined,
      contactId: contactId ?? undefined,
      notes: notes ?? undefined,
      owner: owner ?? undefined,
    });
  } catch (err) {
    console.error("createDeal: failed to insert deal", err);
    return { error: "Couldn't create the deal. Please try again." };
  }

  revalidatePath("/deals");
  return { success: true };
}

// ─── Bulk CSV import ──────────────────────────────────────────────────────────

const MAX_DEAL_TITLE_LENGTH = 200;

// Per-row validation for an imported deal. Title is required; value/stage/
// currency default when blank and are otherwise validated against the same
// rules as the create form, so a bad cell becomes a precise skip reason rather
// than a silent bad insert. The contact email is matched to an existing contact
// server-side; an empty or unrecognised email simply leaves the deal unlinked.
const DealCsvRowSchema = z.object({
  title: z.preprocess(
    (v) => String(v ?? "").trim(),
    z.string().min(1, "Missing title").max(MAX_DEAL_TITLE_LENGTH, "Title too long")
  ),
  value: z.preprocess((v) => {
    const s = String(v ?? "").trim();
    return s === "" ? null : s;
  }, dealValueSchema),
  stage: z.preprocess((v) => {
    const s = String(v ?? "").trim().toLowerCase();
    return s === "" ? "lead" : s;
  }, z.enum(DEAL_STAGES)),
  currency: z.preprocess((v) => {
    const s = String(v ?? "").trim().toUpperCase();
    // Fall back to the default currency for blank OR unrecognised codes, so a bad
    // currency cell never persists an invalid ISO code (which would later throw a
    // RangeError in Intl.NumberFormat / break aggregation) and never skips the row
    // outright — the deal still imports, just denominated in the default.
    return (VALID_CURRENCIES as readonly string[]).includes(s) ? s : "USD";
  }, z.enum(VALID_CURRENCIES)),
  contactEmail: z.preprocess((v) => {
    const s = String(v ?? "").trim().toLowerCase();
    if (s === "") return null;
    // Keep only well-formed emails for matching; a malformed one is dropped so
    // the deal still imports (just unlinked) rather than being skipped.
    return z.string().email().safeParse(s).success ? s : null;
  }, z.string().nullable()),
});

export type DealImportRow = {
  rowIndex: number;
  title: string;
  value: string;
  stage: string;
  currency: string;
  contactEmail: string;
};

export type BulkImportResult = {
  count: number;
  skipped: ImportSkippedRow[];
  error?: string;
};

// Map a row validation failure to a short, user-facing skip reason keyed on the
// field that failed, so enum/regex internals never leak into the results table.
function dealSkipReason(error: z.ZodError): string {
  const issue = error.issues[0];
  const field = issue?.path[0];
  if (field === "title") return issue?.message ?? "Invalid title";
  if (field === "value") return "Invalid value";
  if (field === "stage") return "Invalid stage";
  if (field === "currency") return "Invalid currency";
  return issue?.message ?? "Invalid data";
}

export async function bulkImportDeals(
  rows: DealImportRow[]
): Promise<BulkImportResult> {
  await requireSession();

  const db = getDb();
  if (!db) return { count: 0, skipped: [], error: "Database not connected" };

  if (!Array.isArray(rows) || rows.length === 0) {
    return { count: 0, skipped: [], error: "No rows to import" };
  }

  const MAX_IMPORT_ROWS = 1000;

  const skipped: ImportSkippedRow[] = [];
  const valid: Array<{ rowIndex: number; data: z.infer<typeof DealCsvRowSchema> }> = [];

  // Normalize raw client input defensively — a row could arrive null, missing
  // fields, or with non-string values if this action is invoked outside the
  // modal — coerce each to a safe shape so nothing below can throw on bad data.
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const normalized = rows.map((r, i) => {
    const o = (r && typeof r === "object" ? r : {}) as Record<string, unknown>;
    return {
      rowIndex: Number.isFinite(o.rowIndex) ? (o.rowIndex as number) : i + 1,
      title: str(o.title),
      value: str(o.value),
      stage: str(o.stage),
      currency: str(o.currency),
      contactEmail: str(o.contactEmail),
    };
  });

  // Cap the batch so an oversized single insert can't exceed Postgres/Neon
  // parameter limits and fail the whole import. Rows beyond the cap are skipped.
  const rowsToProcess = normalized.slice(0, MAX_IMPORT_ROWS);
  for (const r of normalized.slice(MAX_IMPORT_ROWS)) {
    skipped.push({
      row: r.rowIndex,
      name: r.title || "(empty)",
      reason: "Exceeds import limit (max 1000 per batch)",
    });
  }

  for (const r of rowsToProcess) {
    const result = DealCsvRowSchema.safeParse(r);
    if (!result.success) {
      skipped.push({ row: r.rowIndex, name: r.title || "(empty)", reason: dealSkipReason(result.error) });
    } else {
      valid.push({ rowIndex: r.rowIndex, data: result.data });
    }
  }

  if (valid.length === 0) {
    return { count: 0, skipped, error: skipped.length === 0 ? "No rows to import" : undefined };
  }

  // Resolve every referenced contact email to an id in a single case-insensitive
  // query (existing rows may be stored with any casing), then link each deal to
  // its contact in memory — no per-row DB round-trip.
  const emailsToMatch = Array.from(
    new Set(valid.map((v) => v.data.contactEmail).filter((e): e is string => e !== null))
  );
  const emailToId = new Map<string, number>();
  if (emailsToMatch.length > 0) {
    const matched = await db
      .select({ id: schema.contacts.id, email: schema.contacts.email })
      .from(schema.contacts)
      .where(inArray(sql`lower(${schema.contacts.email})`, emailsToMatch));
    for (const row of matched) {
      if (!row.email) continue;
      const lower = row.email.toLowerCase();
      // First match wins so a single deduped contact id is used per email.
      if (!emailToId.has(lower)) emailToId.set(lower, row.id);
    }
  }

  const toInsert = valid.map(({ data }) => ({
    title: data.title,
    value: data.value ?? undefined,
    stage: data.stage,
    currency: data.currency,
    probability: STAGE_PROBABILITY[data.stage] ?? 10,
    contactId: data.contactEmail ? emailToId.get(data.contactEmail) ?? undefined : undefined,
  }));

  try {
    await db.insert(schema.deals).values(toInsert);
  } catch (e) {
    console.error("bulkImportDeals insert failed:", e);
    // Revalidate so the list re-fetches from the DB and any optimistic rows the
    // client rendered are dropped — nothing was saved.
    revalidatePath("/deals");
    return {
      count: 0,
      skipped,
      error: "Could not save deals — the database rejected the import. Please try again.",
    };
  }

  revalidatePath("/deals");
  return { count: toInsert.length, skipped };
}

export async function moveDealStage(
  id: number,
  newStage: string,
  closeReason?: string
): Promise<{ error?: string; noDb?: boolean }> {
  await requireSession();

  const parsed = z.enum(DEAL_STAGES).safeParse(newStage);
  if (!parsed.success) return { error: "Invalid stage" };

  if (!Number.isInteger(id) || id <= 0) return { error: "Deal not found" };

  const db = getDb();
  if (!db) return { noDb: true };

  const [current] = await db
    .select({ stage: schema.deals.stage })
    .from(schema.deals)
    .where(eq(schema.deals.id, id))
    .limit(1);

  if (!current) return { error: "Deal not found" };

  const isTerminal = parsed.data === "won" || parsed.data === "lost";

  const updateStmt = db
    .update(schema.deals)
    .set({
      stage: parsed.data,
      probability: STAGE_PROBABILITY[parsed.data] ?? 10,
      closeReason: isTerminal ? (closeReason?.trim() || null) : null,
      updatedAt: new Date(),
    })
    .where(eq(schema.deals.id, id));

  // Commit the stage change and its change-log entry together so a stage move
  // and its dealEvents record never drift apart.
  try {
    if (current.stage !== parsed.data) {
      const event = DealEventSchema.safeParse({
        dealId: id,
        field: "stage",
        oldValue: current.stage,
        newValue: parsed.data,
      });
      if (!event.success) {
        return { error: "Could not update the deal stage. Please try again." };
      }
      const eventStmt = db.insert(schema.dealEvents).values(event.data);
      await db.batch([updateStmt, eventStmt]);
    } else {
      await db.batch([updateStmt]);
    }
  } catch {
    return { error: "Could not update the deal stage. Please try again." };
  }

  revalidatePath("/deals");
  revalidatePath(`/deals/${id}`);
  return {};
}

type BulkActionResult = { error?: string; count?: number; noDb?: boolean };

const BulkIdsSchema = z.array(z.number().int().positive()).min(1);

const OwnerSchema = z.string().trim().max(120, "Owner name is too long.");

// Confirm how many of the requested deals still exist. Returns an error string
// ("N of M not found.") when any are missing so callers never report a full
// success on a 0-row (or partial) update against a stale selection.
async function missingDealsError(
  db: NonNullable<ReturnType<typeof getDb>>,
  ids: number[]
): Promise<string | null> {
  const [row] = await db
    .select({ n: count() })
    .from(schema.deals)
    .where(inArray(schema.deals.id, ids));
  const found = row?.n ?? 0;
  if (found >= ids.length) return null;
  return `${ids.length - found} of ${ids.length} not found.`;
}

export async function bulkMoveStage(
  ids: number[],
  stage: string
): Promise<BulkActionResult> {
  await requireSession();

  const parsedIds = BulkIdsSchema.safeParse(ids);
  if (!parsedIds.success) return { error: "Invalid deal IDs." };
  const parsedStage = z.enum(DEAL_STAGES).safeParse(stage);
  if (!parsedStage.success) return { error: "Invalid stage." };

  const db = getDb();
  if (!db) return { noDb: true };

  const missing = await missingDealsError(db, parsedIds.data);
  if (missing) return { error: missing };

  try {
    await db
      .update(schema.deals)
      .set({
        stage: parsedStage.data,
        probability: STAGE_PROBABILITY[parsedStage.data] ?? 10,
        closeReason: null,
        updatedAt: new Date(),
      })
      .where(inArray(schema.deals.id, parsedIds.data));
  } catch {
    return { error: "Couldn't move the deals. Please try again." };
  }

  revalidatePath("/deals");
  return { count: parsedIds.data.length };
}

export async function bulkChangeOwner(
  ids: number[],
  owner: string
): Promise<BulkActionResult> {
  await requireSession();

  const parsedIds = BulkIdsSchema.safeParse(ids);
  if (!parsedIds.success) return { error: "Invalid deal IDs." };
  const parsedOwner = OwnerSchema.safeParse(owner ?? "");
  if (!parsedOwner.success) return { error: "Owner name is too long." };

  const db = getDb();
  if (!db) return { noDb: true };

  const missing = await missingDealsError(db, parsedIds.data);
  if (missing) return { error: missing };

  try {
    await db
      .update(schema.deals)
      .set({ owner: parsedOwner.data || null, updatedAt: new Date() })
      .where(inArray(schema.deals.id, parsedIds.data));
  } catch {
    return { error: "Couldn't change the owner. Please try again." };
  }

  revalidatePath("/deals");
  return { count: parsedIds.data.length };
}

export async function bulkDeleteDeals(
  ids: number[]
): Promise<BulkActionResult> {
  await requireSession();

  const parsedIds = BulkIdsSchema.safeParse(ids);
  if (!parsedIds.success) return { error: "Invalid deal IDs." };

  const db = getDb();
  if (!db) return { noDb: true };

  const missing = await missingDealsError(db, parsedIds.data);
  if (missing) return { error: missing };

  try {
    await db
      .delete(schema.deals)
      .where(inArray(schema.deals.id, parsedIds.data));
  } catch {
    return { error: "Couldn't delete the deals. Please try again." };
  }

  revalidatePath("/deals");
  return { count: parsedIds.data.length };
}

export async function updateDeal(
  id: number,
  _prev: DealFormState,
  formData: FormData
): Promise<DealFormState> {
  await requireSession();

  if (!idSchema.safeParse(id).success) return { error: "Invalid deal id." };

  const raw = parseFormData(formData);
  const parsed = DealSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten()
        .fieldErrors as DealFormState["fieldErrors"],
    };
  }

  const db = getDb();
  if (!db) return { noDb: true };

  const [current] = await db
    .select({
      stage: schema.deals.stage,
      value: schema.deals.value,
      notes: schema.deals.notes,
      probability: schema.deals.probability,
    })
    .from(schema.deals)
    .where(eq(schema.deals.id, id))
    .limit(1);
  if (!current) return { error: "Deal not found." };

  const { title, stage, value, currency, expectedCloseDate, contactId, notes, owner } =
    parsed.data;

  // Derive probability from the new stage (like createDeal/moveDealStage) so
  // editing a deal into Won/Lost can't leave a stale probability behind.
  const newProbability = STAGE_PROBABILITY[stage] ?? 10;
  const isTerminal = stage === "won" || stage === "lost";

  // Preserve any AI win/loss insight stored alongside the user notes — the edit
  // form only ever submits the user-authored portion, so re-attach the insight.
  const existingInsight = extractWinLossInsight(current?.notes ?? null);
  const submittedNotes = extractUserNotes(notes);
  const finalNotes = submittedNotes
    ? submittedNotes + (existingInsight ? WIN_LOSS_MARKER + existingInsight : "")
    : existingInsight
      ? WIN_LOSS_MARKER.trimStart() + existingInsight
      : null;

  try {
    await db
      .update(schema.deals)
      .set({
        title,
        stage,
        value: value,
        currency,
        probability: newProbability,
        // Clear the close reason when the deal leaves a terminal stage; the edit
        // form never submits one, so leave it untouched while still won/lost.
        ...(isTerminal ? {} : { closeReason: null }),
        expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : null,
        contactId: contactId,
        notes: finalNotes,
        owner: owner,
        updatedAt: new Date(),
      })
      .where(eq(schema.deals.id, id));

    const events: Array<{ dealId: number; field: string; oldValue: string | null; newValue: string | null }> = [];
    if (current.stage !== stage) {
      events.push({ dealId: id, field: "stage", oldValue: current.stage, newValue: stage });
    }
    if (!numericEqual(current.value, value)) {
      events.push({ dealId: id, field: "value", oldValue: current.value ?? null, newValue: value ?? null });
    }
    if (current.probability !== newProbability) {
      events.push({
        dealId: id,
        field: "probability",
        oldValue: String(current.probability),
        newValue: String(newProbability),
      });
    }
    if (events.length > 0) {
      const parsedEvents = z.array(DealEventSchema).safeParse(events);
      if (!parsedEvents.success) {
        return { error: "Couldn't save the deal. Please try again." };
      }
      await db.insert(schema.dealEvents).values(parsedEvents.data);
    }
  } catch {
    return { error: "Couldn't save the deal. Please try again." };
  }

  revalidatePath("/deals");
  revalidatePath(`/deals/${id}`);
  return { success: true };
}
