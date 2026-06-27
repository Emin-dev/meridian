"use server";

import { createHash } from "node:crypto";
import { z } from "zod";
import { eq, desc, inArray, and, isNull, notInArray, sql, lte, count as countFn } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { chat } from "@/lib/ai";
import { parseAiJson } from "@/lib/ai-json";
import { requireSession } from "@/lib/require-session";
import { checkAiRateLimit } from "@/lib/ai-rate-limit";
import {
  BULK_SCORE_BATCH,
  BULK_SCORE_CONCURRENCY,
  BULK_SCORE_DEADLINE_MS,
  summarizeBulkScore,
} from "@/lib/bulk-score";

// Validates an id-only argument coming from a client action call, so a bad id
// (NaN, 0, negative, non-integer) can't reach a DB query.
const idSchema = z.coerce.number().int().positive();

const SOURCE_VALUES = ["website", "referral", "linkedin", "cold-outreach", "other"] as const;

const ContactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z
    .string()
    .email("Invalid email address")
    .or(z.literal(""))
    .transform((v) => (v === "" ? null : v)),
  phone: z.string().transform((v) => (v === "" ? null : v)),
  company: z.string().transform((v) => (v === "" ? null : v)),
  title: z.string().transform((v) => (v === "" ? null : v)),
  notes: z.string().transform((v) => (v === "" ? null : v)),
  source: z
    .enum(SOURCE_VALUES)
    .or(z.literal(""))
    .transform((v) => (v === "" ? null : v)),
  owner: z.string().transform((v) => (v === "" ? null : v)),
});

export type ContactFormState = {
  error?: string;
  fieldErrors?: Partial<
    Record<"name" | "email" | "phone" | "company" | "title" | "notes" | "source" | "owner", string[]>
  >;
  success?: boolean;
  noDb?: boolean;
};

function parseTags(formData: FormData): string[] {
  try {
    const raw = String(formData.get("tags") ?? "[]");
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((t): t is string => typeof t === "string")
      .map((t) => t.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export async function createContact(
  _prev: ContactFormState,
  formData: FormData
): Promise<ContactFormState> {
  await requireSession();

  const raw = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    company: String(formData.get("company") ?? ""),
    title: String(formData.get("title") ?? ""),
    notes: String(formData.get("notes") ?? ""),
    source: String(formData.get("source") ?? ""),
    owner: String(formData.get("owner") ?? ""),
  };

  const parsed = ContactSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten()
        .fieldErrors as ContactFormState["fieldErrors"],
    };
  }

  const db = getDb();
  if (!db) return { noDb: true };

  try {
    await db.insert(schema.contacts).values({
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      company: parsed.data.company,
      title: parsed.data.title,
      notes: parsed.data.notes,
      source: parsed.data.source,
      owner: parsed.data.owner,
      tags: parseTags(formData),
    });
  } catch (err) {
    console.error("createContact failed:", err);
    return { error: "Could not save contact — please try again." };
  }

  revalidatePath("/contacts");
  return { success: true };
}

const MAX_CSV_NAME_LENGTH = 200;
const MAX_CSV_EMAIL_LENGTH = 320; // RFC 5321 maximum address length
const MAX_CSV_FIELD_LENGTH = 500; // phone / company

// Per-row validation for an imported contact. Inputs are trimmed and emails
// normalized to lowercase so duplicate detection is reliable, and each failure
// carries a precise, user-facing message that becomes the skip reason.
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

export type ImportSkippedRow = {
  row: number;
  name: string;
  reason: string;
};

export type BulkImportResult = {
  count: number;
  skipped: ImportSkippedRow[];
  error?: string;
};

export async function bulkImportContacts(
  rows: { rowIndex: number; name: string; email: string; phone: string; company: string }[]
): Promise<BulkImportResult> {
  await requireSession();

  const db = getDb();
  if (!db) return { count: 0, skipped: [], error: "Database not connected" };

  if (!Array.isArray(rows) || rows.length === 0) {
    return { count: 0, skipped: [], error: "No rows to import" };
  }

  // Cap the batch so a single call stays well under Vercel's 10s limit (one
  // bounded email lookup + one multi-row insert). Reject an oversized paste
  // outright with a friendly message rather than importing only the first N
  // rows and silently dropping the rest — and rather than normalizing/echoing
  // tens of thousands of rows back to the client.
  const MAX_IMPORT_ROWS = 1000;
  if (rows.length > MAX_IMPORT_ROWS) {
    return {
      count: 0,
      skipped: [],
      error: `That's too many rows to import at once (${rows.length}). Please import up to ${MAX_IMPORT_ROWS} contacts at a time and split larger lists into smaller batches.`,
    };
  }

  const skipped: ImportSkippedRow[] = [];
  const valid: Array<{ rowIndex: number; data: z.infer<typeof CsvRowSchema> }> = [];

  // Normalize raw client input defensively. A row could arrive null, missing
  // fields, or with non-string values if this action is invoked outside the
  // modal — coerce each to a safe shape so nothing below can throw on bad data.
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const normalized = rows.map((r, i) => {
    const o = (r && typeof r === "object" ? r : {}) as Record<string, unknown>;
    return {
      rowIndex: Number.isFinite(o.rowIndex) ? (o.rowIndex as number) : i + 1,
      name: str(o.name),
      email: str(o.email),
      phone: str(o.phone),
      company: str(o.company),
    };
  });

  for (const r of normalized) {
    const result = CsvRowSchema.safeParse(r);
    if (!result.success) {
      const reason = result.error.issues[0]?.message || "Invalid data";
      skipped.push({ row: r.rowIndex, name: r.name || "(empty)", reason });
    } else {
      valid.push({ rowIndex: r.rowIndex, data: result.data });
    }
  }

  if (valid.length === 0) {
    return { count: 0, skipped, error: skipped.length === 0 ? "No rows to import" : undefined };
  }

  // Check for emails that already exist in the database
  const emailsToCheck = valid
    .map((v) => v.data.email)
    .filter((e): e is string => e !== null);

  // Compare case-insensitively: existing rows may have been entered with any
  // casing (createContact stores email verbatim), so match on lower(email)
  // against the already-lowercased import emails to catch every duplicate.
  const existingEmails = new Set<string>();
  if (emailsToCheck.length > 0) {
    const existing = await db
      .select({ email: schema.contacts.email })
      .from(schema.contacts)
      .where(inArray(sql`lower(${schema.contacts.email})`, emailsToCheck));
    for (const row of existing) {
      if (row.email) existingEmails.add(row.email.toLowerCase());
    }
  }

  // Also deduplicate within the batch itself
  const seenEmailsInBatch = new Set<string>();
  const toInsert: z.infer<typeof CsvRowSchema>[] = [];

  for (const { rowIndex, data } of valid) {
    if (data.email) {
      const lower = data.email.toLowerCase();
      if (existingEmails.has(lower)) {
        skipped.push({ row: rowIndex, name: data.name, reason: `Duplicate email (${data.email})` });
        continue;
      }
      if (seenEmailsInBatch.has(lower)) {
        skipped.push({ row: rowIndex, name: data.name, reason: `Duplicate email in import (${data.email})` });
        continue;
      }
      seenEmailsInBatch.add(lower);
    }
    toInsert.push(data);
  }

  if (toInsert.length > 0) {
    try {
      await db.insert(schema.contacts).values(toInsert);
    } catch (e) {
      console.error("bulkImportContacts insert failed:", e);
      // Revalidate so the list re-fetches from the DB and any optimistic
      // "imported" rows the client rendered are dropped — nothing was saved.
      revalidatePath("/contacts");
      return {
        count: 0,
        skipped,
        error: "Could not save contacts — the database rejected the import. Please try again.",
      };
    }
  }

  revalidatePath("/contacts");
  return { count: toInsert.length, skipped };
}

export async function updateContact(
  id: number,
  _prev: ContactFormState,
  formData: FormData
): Promise<ContactFormState> {
  await requireSession();

  if (!idSchema.safeParse(id).success) return { error: "Invalid contact id." };

  const raw = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    company: String(formData.get("company") ?? ""),
    title: String(formData.get("title") ?? ""),
    notes: String(formData.get("notes") ?? ""),
    source: String(formData.get("source") ?? ""),
    owner: String(formData.get("owner") ?? ""),
  };

  const parsed = ContactSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten()
        .fieldErrors as ContactFormState["fieldErrors"],
    };
  }

  const db = getDb();
  if (!db) return { noDb: true };

  const [existing] = await db
    .select({ id: schema.contacts.id })
    .from(schema.contacts)
    .where(eq(schema.contacts.id, id))
    .limit(1);
  if (!existing) return { error: "Contact not found." };

  try {
    await db
      .update(schema.contacts)
      .set({
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone,
        company: parsed.data.company,
        title: parsed.data.title,
        notes: parsed.data.notes,
        source: parsed.data.source,
        owner: parsed.data.owner,
        tags: parseTags(formData),
        updatedAt: new Date(),
      })
      .where(eq(schema.contacts.id, id));
  } catch (err) {
    console.error("updateContact failed:", err);
    return { error: "Could not save changes — please try again." };
  }

  revalidatePath(`/contacts/${id}`);
  revalidatePath("/contacts");
  return { success: true };
}

// ─── Update contact notes only ────────────────────────────────────────────────

export type UpdateContactNotesState = {
  success?: boolean;
  error?: string;
  noDb?: boolean;
};

export async function updateContactNotes(
  id: number,
  _prev: UpdateContactNotesState,
  formData: FormData
): Promise<UpdateContactNotesState> {
  await requireSession();

  if (!idSchema.safeParse(id).success) return { error: "Invalid contact id." };

  const db = getDb();
  if (!db) return { noDb: true };

  const notes = String(formData.get("notes") ?? "").trim() || null;

  const [existing] = await db
    .select({ id: schema.contacts.id })
    .from(schema.contacts)
    .where(eq(schema.contacts.id, id))
    .limit(1);
  if (!existing) return { error: "Contact not found." };

  try {
    await db
      .update(schema.contacts)
      .set({ notes, updatedAt: new Date() })
      .where(eq(schema.contacts.id, id));
  } catch (err) {
    console.error("updateContactNotes failed:", err);
    return { error: "Could not save notes — please try again." };
  }

  revalidatePath(`/contacts/${id}`);
  revalidatePath("/contacts");
  return { success: true };
}

export async function deleteContact(id: number): Promise<void> {
  await requireSession();

  if (!idSchema.safeParse(id).success) return;

  const db = getDb();
  if (!db) return;

  // Catch real DB/FK failures and surface a friendly message; the redirect()
  // below stays OUTSIDE the try so its control-flow signal is never swallowed.
  try {
    // Confirm the contact still exists before deleting + revalidating: a
    // double-tap or stale link can land here after it's already gone, so skip
    // the write and fall through to the safe list redirect.
    const [existing] = await db
      .select({ id: schema.contacts.id })
      .from(schema.contacts)
      .where(eq(schema.contacts.id, id))
      .limit(1);
    if (existing) {
      await db.delete(schema.contacts).where(eq(schema.contacts.id, id));
      revalidatePath("/contacts");
    }
  } catch (err) {
    console.error("deleteContact failed:", err);
    throw new Error("Could not delete this contact — please try again.");
  }

  redirect("/contacts");
}

// ─── AI: Summarize contact notes & activity ──────────────────────────────────

export type SummarizeState = {
  summary?: string;
  summaryAt?: string;
  error?: string;
  noDb?: boolean;
  noKey?: boolean;
};

export async function summarizeContact(
  contactId: number
): Promise<SummarizeState> {
  await requireSession();

  const limited = await checkAiRateLimit();
  if (limited) return { error: limited };

  if (!idSchema.safeParse(contactId).success) return { error: "Invalid contact id." };

  const db = getDb();
  if (!db) return { noDb: true };

  // Bail out before touching the DB when AI is unconfigured — avoids wasted reads.
  if (!process.env.DEEPSEEK_API_KEY) return { noKey: true };

  // The contact row and its recent activities are both keyed on contactId and
  // independent, so fetch them together to cut a round-trip of request latency.
  const [[contact], recentActivities] = await Promise.all([
    db
      .select()
      .from(schema.contacts)
      .where(eq(schema.contacts.id, contactId))
      .limit(1),
    db
      .select()
      .from(schema.activities)
      .where(eq(schema.activities.contactId, contactId))
      .orderBy(desc(schema.activities.createdAt))
      .limit(10),
  ]);

  if (!contact) return { error: "Contact not found." };

  const lines: string[] = [
    `Name: ${contact.name}`,
    contact.title ? `Title: ${contact.title}` : null,
    contact.company ? `Company: ${contact.company}` : null,
    contact.email ? `Email: ${contact.email}` : null,
    contact.notes ? `\nNotes:\n${contact.notes}` : null,
  ].filter(Boolean) as string[];

  if (recentActivities.length > 0) {
    lines.push("\nRecent activities:");
    for (const a of recentActivities) {
      const date = a.createdAt.toISOString().slice(0, 10);
      const entry = [
        `[${date}] ${a.type.toUpperCase()}: ${a.subject}`,
        a.body ?? null,
      ]
        .filter(Boolean)
        .join(" — ");
      lines.push(`- ${entry}`);
    }
  }

  try {
    const summary = await chat([
      {
        role: "system",
        content:
          "You are a CRM assistant. Given a contact's profile, notes, and recent activity, write a concise 3–5 sentence brief summarising who this person is, the relationship status, and any key next steps. Be direct and factual.",
      },
      {
        role: "user",
        content: `Summarise this contact:\n\n${lines.join("\n")}`,
      },
    ], { maxTokens: 512 });

    // A blank/whitespace-only completion is a successful call with no usable
    // output — surface a friendly error instead of silently caching "" and
    // dropping the panel back to its idle hint with no feedback.
    if (!summary.trim()) {
      return { error: "AI returned an empty summary. Please try again." };
    }

    const summaryAt = new Date();

    // Cache result to the contact row (best-effort — columns may not exist yet)
    try {
      await db
        .update(schema.contacts)
        .set({ aiSummary: summary, aiSummaryAt: summaryAt, updatedAt: new Date() })
        .where(eq(schema.contacts.id, contact.id));
      revalidatePath(`/contacts/${contact.id}`);
    } catch {
      // Ignore — DB columns may not yet be migrated
    }

    return { summary, summaryAt: summaryAt.toISOString() };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown AI error.";
    if (message.includes("DEEPSEEK_API_KEY")) return { noKey: true };
    return { error: message };
  }
}

// ─── AI: Lead scoring ────────────────────────────────────────────────────────

export type ScoreState = {
  score?: number;
  rationale?: string;
  error?: string;
  noDb?: boolean;
  noKey?: boolean;
};

// Score a single contact from data that has already been fetched. Shared by
// scoreContact (one contact) and bulkScoreContacts (pre-fetched batch) so the
// AI prompt and caching logic stay identical and the bulk path avoids re-
// querying the DB per contact.
// Only the activity fields the prompt actually renders, so callers can pass a
// narrowed select (the bulk path fetches just these columns to cut payload).
type ScoringActivity = Pick<
  typeof schema.activities.$inferSelect,
  "id" | "contactId" | "type" | "subject" | "body" | "createdAt"
>;

async function scoreContactFromData(
  db: NonNullable<ReturnType<typeof getDb>>,
  contact: typeof schema.contacts.$inferSelect,
  recentActivities: ScoringActivity[]
): Promise<ScoreState> {
  const lines: string[] = [
    `Name: ${contact.name}`,
    contact.title ? `Title: ${contact.title}` : null,
    contact.company ? `Company: ${contact.company}` : null,
    contact.email ? `Email: ${contact.email}` : null,
    contact.phone ? `Phone: ${contact.phone}` : null,
    contact.notes ? `\nNotes:\n${contact.notes}` : null,
  ].filter(Boolean) as string[];

  if (recentActivities.length > 0) {
    lines.push("\nRecent activities:");
    for (const a of recentActivities) {
      const date = a.createdAt.toISOString().slice(0, 10);
      const entry = [`[${date}] ${a.type.toUpperCase()}: ${a.subject}`, a.body ?? null]
        .filter(Boolean)
        .join(" — ");
      lines.push(`- ${entry}`);
    }
  } else {
    lines.push("\nNo recorded activities.");
  }

  try {
    const raw = await chat(
      [
        {
          role: "system",
          content:
            'You are a lead scoring expert. Score a sales lead 0–100 based on profile completeness, engagement signals, and relationship quality. 0 = cold/unknown, 100 = highly engaged, ready to buy. Return JSON with exactly two keys: "score" (integer 0–100) and "rationale" (one paragraph, max 80 words, explaining the score). No other text.',
        },
        {
          role: "user",
          content: `Score this lead:\n\n${lines.join("\n")}`,
        },
      ],
      { json: true }
    );

    const parsed = parseAiJson<{ score: unknown; rationale: unknown }>(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { error: "AI returned an unexpected format. Please try again." };
    }
    const score = Math.round(Number(parsed.score));
    const rationale = String(parsed.rationale ?? "");

    if (!Number.isFinite(score) || score < 0 || score > 100) {
      return { error: "AI returned an invalid score." };
    }

    // Cache result to the contact row (best-effort — columns may not exist yet)
    try {
      await db
        .update(schema.contacts)
        .set({ leadScore: score, leadScoreRationale: rationale, leadScoredAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.contacts.id, contact.id));
      revalidatePath(`/contacts/${contact.id}`);
      revalidatePath("/contacts");
    } catch {
      // Ignore — DB columns may not yet be migrated
    }

    return { score, rationale };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown AI error.";
    if (message.includes("DEEPSEEK_API_KEY")) return { noKey: true };
    return { error: message };
  }
}

export async function scoreContact(contactId: number): Promise<ScoreState> {
  await requireSession();

  const limited = await checkAiRateLimit();
  if (limited) return { error: limited };

  if (!idSchema.safeParse(contactId).success) return { error: "Invalid contact id." };

  const db = getDb();
  if (!db) return { noDb: true };

  // The contact row and its recent activities are both keyed on contactId and
  // independent, so fetch them together to keep the action under the 10s limit.
  const [[contact], recentActivities] = await Promise.all([
    db
      .select()
      .from(schema.contacts)
      .where(eq(schema.contacts.id, contactId))
      .limit(1),
    db
      .select()
      .from(schema.activities)
      .where(eq(schema.activities.contactId, contactId))
      .orderBy(desc(schema.activities.createdAt))
      .limit(20),
  ]);

  if (!contact) return { error: "Contact not found." };

  if (!process.env.DEEPSEEK_API_KEY) return { noKey: true };

  return scoreContactFromData(db, contact, recentActivities);
}

// ─── AI: Bulk lead scoring ────────────────────────────────────────────────────

export type BulkScoreState = {
  count?: number;
  failed?: number;
  remaining?: number;
  error?: string;
  noDb?: boolean;
  noKey?: boolean;
};

export async function bulkScoreContacts(): Promise<BulkScoreState> {
  await requireSession();

  const limited = await checkAiRateLimit();
  if (limited) return { error: limited };

  const db = getDb();
  if (!db) return { noDb: true };
  if (!process.env.DEEPSEEK_API_KEY) return { noKey: true };

  // Count all unscored contacts so we can tell the user how many remain after
  // this capped batch, then pre-fetch only the next BULK_SCORE_BATCH in a single
  // query rather than re-querying each contact inside scoreContact.
  const [{ value: totalUnscored }] = await db
    .select({ value: countFn() })
    .from(schema.contacts)
    .where(isNull(schema.contacts.leadScore));

  if (totalUnscored === 0) return { count: 0, remaining: 0 };

  const contactsToScore = await db
    .select()
    .from(schema.contacts)
    .where(isNull(schema.contacts.leadScore))
    .limit(BULK_SCORE_BATCH);

  if (contactsToScore.length === 0) return { count: 0, remaining: 0 };

  // Fetch only the recent activities the scoring prompt actually uses: rank each
  // contact's activities newest-first and keep the top SCORING_WINDOW per contact
  // (matching scoreContact's limit(20)) inside the query, so the DB returns at
  // most 20 rows per contact instead of every activity row to filter in memory.
  const SCORING_WINDOW = 20;
  const contactIds = contactsToScore.map((c) => c.id);
  const ranked = db
    .select({
      // Only the columns scoreContactFromData reads — skip the rest (e.g. the
      // potentially long `body` is needed, but other wide columns are not) to
      // keep the per-batch payload small on large workspaces.
      id: schema.activities.id,
      contactId: schema.activities.contactId,
      type: schema.activities.type,
      subject: schema.activities.subject,
      body: schema.activities.body,
      createdAt: schema.activities.createdAt,
      rn: sql<number>`row_number() over (partition by ${schema.activities.contactId} order by ${schema.activities.createdAt} desc)`.as(
        "rn"
      ),
    })
    .from(schema.activities)
    .where(inArray(schema.activities.contactId, contactIds))
    .as("ranked");

  const activityRows = await db
    .select()
    .from(ranked)
    .where(lte(ranked.rn, SCORING_WINDOW))
    .orderBy(desc(ranked.createdAt));

  const activitiesByContact = new Map<number, typeof activityRows>();
  for (const a of activityRows) {
    if (a.contactId == null) continue;
    const list = activitiesByContact.get(a.contactId);
    if (list) {
      list.push(a);
    } else {
      activitiesByContact.set(a.contactId, [a]);
    }
  }

  // Score with a small fixed concurrency so the batch finishes far faster than
  // the old one-at-a-time loop, while staying gentle on the DeepSeek API. A
  // per-contact try/catch keeps a single failure from aborting the whole batch.
  // A soft wall-clock deadline stops launching new scoring calls once the budget
  // is spent, so even a slow batch can't compound wave-on-wave past Vercel's 10s
  // request limit — un-attempted contacts simply fall through to `remaining`.
  const database = db;
  const deadline = Date.now() + BULK_SCORE_DEADLINE_MS;
  let cursor = 0;
  const attemptedIds: number[] = [];

  async function worker() {
    while (cursor < contactsToScore.length && Date.now() < deadline) {
      const contact = contactsToScore[cursor++];
      attemptedIds.push(contact.id);
      try {
        await scoreContactFromData(
          database,
          contact,
          activitiesByContact.get(contact.id) ?? []
        );
      } catch {
        // Swallow per-contact failures so one bad call never aborts the batch;
        // the contact stays unscored and is re-picked (counted in `failed`).
      }
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(BULK_SCORE_CONCURRENCY, contactsToScore.length) },
      () => worker()
    )
  );

  // Nothing was attempted (deadline already passed before any work) — report the
  // full backlog as remaining so the user can re-run.
  if (attemptedIds.length === 0) {
    return { count: 0, failed: 0, remaining: totalUnscored };
  }

  // Derive the tally from the DB rather than the in-loop result: a contact only
  // counts as scored if its leadScore actually persisted. Of the contacts we
  // *attempted*, any still null had its AI score error (or its best-effort write
  // silently no-op), so it counts as `failed`. Contacts the deadline skipped
  // were never attempted and fall through to `remaining` instead.
  const [{ value: stillNullAmongAttempted }] = await database
    .select({ value: countFn() })
    .from(schema.contacts)
    .where(and(inArray(schema.contacts.id, attemptedIds), isNull(schema.contacts.leadScore)));

  revalidatePath("/contacts");
  return summarizeBulkScore(totalUnscored, attemptedIds.length, stillNullAmongAttempted);
}

// ─── AI: Next best action suggestion ─────────────────────────────────────────

export type NextActionState = {
  action?: string;
  priority?: "high" | "medium" | "low";
  rationale?: string;
  suggestedMessage?: string;
  suggestedAt?: string;
  error?: string;
  noDb?: boolean;
  noKey?: boolean;
};

export async function suggestNextAction(
  contactId: number
): Promise<NextActionState> {
  await requireSession();

  const limited = await checkAiRateLimit();
  if (limited) return { error: limited };

  if (!idSchema.safeParse(contactId).success) return { error: "Invalid contact id." };

  const db = getDb();
  if (!db) return { noDb: true };

  // Bail out before touching the DB when AI is unconfigured — avoids wasted reads.
  if (!process.env.DEEPSEEK_API_KEY) return { noKey: true };

  const [contact] = await db
    .select()
    .from(schema.contacts)
    .where(eq(schema.contacts.id, contactId))
    .limit(1);

  if (!contact) return { error: "Contact not found." };

  const recentActivities = await db
    .select()
    .from(schema.activities)
    .where(eq(schema.activities.contactId, contactId))
    .orderBy(desc(schema.activities.createdAt))
    .limit(15);

  const lines: string[] = [
    `Name: ${contact.name}`,
    contact.title ? `Title: ${contact.title}` : null,
    contact.company ? `Company: ${contact.company}` : null,
    contact.email ? `Email: ${contact.email}` : null,
    contact.leadScore != null ? `Lead score: ${contact.leadScore}/100` : null,
    contact.leadScoreRationale
      ? `Score rationale: ${contact.leadScoreRationale}`
      : null,
    contact.notes ? `\nNotes:\n${contact.notes}` : null,
  ].filter(Boolean) as string[];

  if (recentActivities.length > 0) {
    lines.push("\nRecent activities (newest first):");
    for (const a of recentActivities) {
      const date = a.createdAt.toISOString().slice(0, 10);
      const entry = [`[${date}] ${a.type.toUpperCase()}: ${a.subject}`, a.body ?? null]
        .filter(Boolean)
        .join(" — ");
      lines.push(`- ${entry}`);
    }
  } else {
    lines.push("\nNo recorded activities.");
  }

  try {
    const raw = await chat(
      [
        {
          role: "system",
          content:
            'You are an expert sales strategist. Given a CRM contact\'s profile, lead score, notes, and recent activities, recommend the single best next action the sales rep should take to advance the relationship. Return JSON with exactly four keys: "action" (short imperative phrase, max 8 words), "priority" ("high", "medium", or "low"), "rationale" (one or two sentences explaining why this action now), and "suggestedMessage" (a ready-to-send short message or email the rep can copy, 60–120 words). No other text.',
        },
        {
          role: "user",
          content: `Suggest the next best action for this contact:\n\n${lines.join("\n")}`,
        },
      ],
      { json: true }
    );

    const parsed = parseAiJson<{
      action: unknown;
      priority: unknown;
      rationale: unknown;
      suggestedMessage: unknown;
    }>(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { error: "AI returned an unexpected format. Please try again." };
    }

    const action = String(parsed.action ?? "").trim();
    const priority = (["high", "medium", "low"] as const).includes(
      parsed.priority as "high" | "medium" | "low"
    )
      ? (parsed.priority as "high" | "medium" | "low")
      : "medium";
    const rationale = String(parsed.rationale ?? "").trim();
    const suggestedMessage = String(parsed.suggestedMessage ?? "").trim();

    if (!action) return { error: "AI returned an empty action." };

    const suggestedAt = new Date();

    // Cache result to the contact row (best-effort — columns may not exist yet)
    try {
      await db
        .update(schema.contacts)
        .set({
          nextAction: JSON.stringify({ action, priority, rationale, suggestedMessage }),
          nextActionAt: suggestedAt,
          updatedAt: new Date(),
        })
        .where(eq(schema.contacts.id, contact.id));
      revalidatePath(`/contacts/${contact.id}`);
    } catch {
      // Ignore — DB columns may not yet be migrated
    }

    return { action, priority, rationale, suggestedMessage, suggestedAt: suggestedAt.toISOString() };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown AI error.";
    if (message.includes("DEEPSEEK_API_KEY")) return { noKey: true };
    return { error: message };
  }
}

// ─── AI: Contact enrichment ───────────────────────────────────────────────────

export type EnrichState = {
  title?: string;
  company?: string;
  notes?: string;
  error?: string;
  noDb?: boolean;
  noKey?: boolean;
};

// Validate the enrichment payload the model returns. Every field is an optional
// string so a malformed/nulled response (missing keys, numbers, nested objects)
// is rejected here rather than silently coerced into garbage suggestions.
const EnrichResponseSchema = z.object({
  title: z.string().optional(),
  company: z.string().optional(),
  notes: z.string().optional(),
});

export async function enrichContact(contactId: number): Promise<EnrichState> {
  await requireSession();

  const limited = await checkAiRateLimit();
  if (limited) return { error: limited };

  if (!idSchema.safeParse(contactId).success) return { error: "Invalid contact id." };

  const db = getDb();
  if (!db) return { noDb: true };

  const [contact] = await db
    .select()
    .from(schema.contacts)
    .where(eq(schema.contacts.id, contactId))
    .limit(1);

  if (!contact) return { error: "Contact not found." };

  if (!process.env.DEEPSEEK_API_KEY) return { noKey: true };

  const recentActivities = await db
    .select()
    .from(schema.activities)
    .where(eq(schema.activities.contactId, contactId))
    .orderBy(desc(schema.activities.createdAt))
    .limit(10);

  const lines: string[] = [
    `Name: ${contact.name}`,
    contact.title ? `Title (already known): ${contact.title}` : "Title: (missing)",
    contact.company ? `Company (already known): ${contact.company}` : "Company: (missing)",
    contact.email ? `Email: ${contact.email}` : null,
    contact.notes ? `\nExisting notes:\n${contact.notes}` : null,
  ].filter(Boolean) as string[];

  if (recentActivities.length > 0) {
    lines.push("\nRecent activities:");
    for (const a of recentActivities) {
      const date = a.createdAt.toISOString().slice(0, 10);
      const entry = [
        `[${date}] ${a.type.toUpperCase()}: ${a.subject}`,
        a.body ?? null,
      ]
        .filter(Boolean)
        .join(" — ");
      lines.push(`- ${entry}`);
    }
  }

  try {
    const raw = await chat(
      [
        {
          role: "system",
          content:
            'You are a CRM data enrichment assistant. Given a contact\'s name, email, and activity history, infer or suggest values for missing or incomplete profile fields. Return JSON with exactly three keys: "title" (job title — infer from email domain, activity context, or name patterns; empty string if truly unknown), "company" (company name — infer from email domain or activity context; empty string if unknown), and "notes" (2–3 sentences of relevant context based on available signals, incorporating any existing notes). Only output JSON, no other text.',
        },
        {
          role: "user",
          content: `Enrich this contact:\n\n${lines.join("\n")}`,
        },
      ],
      { json: true }
    );

    const parsed = parseAiJson<unknown>(raw);
    const validated = EnrichResponseSchema.safeParse(parsed);
    if (!validated.success) {
      return { error: "AI returned an unexpected format. Please try again." };
    }

    return {
      title: (validated.data.title ?? "").trim(),
      company: (validated.data.company ?? "").trim(),
      notes: (validated.data.notes ?? "").trim(),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown AI error.";
    if (message.includes("DEEPSEEK_API_KEY")) return { noKey: true };
    return { error: message };
  }
}

export type ApplyEnrichmentState = {
  success?: boolean;
  error?: string;
  noDb?: boolean;
};

// Bound the enrichment fields the client applies. Trimmed so blank-after-trim
// values persist as null, and capped so a tampered/oversized payload can't write
// unbounded text to the contact record.
const ApplyEnrichmentSchema = z.object({
  title: z.string().trim().max(200, "Title is too long."),
  company: z.string().trim().max(200, "Company is too long."),
  notes: z.string().trim().max(5000, "Notes are too long."),
});

export async function applyContactEnrichment(
  contactId: number,
  fields: { title: string; company: string; notes: string }
): Promise<ApplyEnrichmentState> {
  await requireSession();

  if (!idSchema.safeParse(contactId).success) {
    return { error: "Contact not found" };
  }

  const parsedFields = ApplyEnrichmentSchema.safeParse(fields);
  if (!parsedFields.success) {
    return { error: parsedFields.error.issues[0]?.message ?? "Invalid enrichment data." };
  }
  const { title, company, notes } = parsedFields.data;

  const db = getDb();
  if (!db) return { noDb: true };

  try {
    await db
      .update(schema.contacts)
      .set({
        title: title || null,
        company: company || null,
        notes: notes || null,
        updatedAt: new Date(),
      })
      .where(eq(schema.contacts.id, contactId));

    revalidatePath(`/contacts/${contactId}`);
    revalidatePath("/contacts");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return { error: message };
  }
}

// ─── AI: Draft outreach email ─────────────────────────────────────────────────

export type DraftEmailState = {
  draft?: string;
  error?: string;
  noDb?: boolean;
  noKey?: boolean;
};

// ─── Bulk Actions ─────────────────────────────────────────────────────────────

export type BulkActionState = {
  success?: boolean;
  count?: number;
  error?: string;
  noDb?: boolean;
};

const CONTACT_STATUSES = ["lead", "active", "inactive", "churned"] as const;
type BulkContactStatus = (typeof CONTACT_STATUSES)[number];

const BulkIdsSchema = z.array(z.number().int().positive()).min(1);

// Confirm how many of the requested contacts still exist. Returns an error
// string ("N of M not found.") when any are missing so callers never report a
// full success on a 0-row (or partial) update against a stale selection.
async function missingContactsError(
  db: NonNullable<ReturnType<typeof getDb>>,
  ids: number[]
): Promise<string | null> {
  const [row] = await db
    .select({ n: countFn() })
    .from(schema.contacts)
    .where(inArray(schema.contacts.id, ids));
  const found = row?.n ?? 0;
  if (found >= ids.length) return null;
  return `${ids.length - found} of ${ids.length} not found.`;
}

export async function bulkChangeStatus(
  ids: number[],
  status: BulkContactStatus
): Promise<BulkActionState> {
  await requireSession();

  const parsedIds = BulkIdsSchema.safeParse(ids);
  if (!parsedIds.success) return { error: "Invalid contact IDs." };

  const db = getDb();
  if (!db) return { noDb: true };

  const missing = await missingContactsError(db, parsedIds.data);
  if (missing) return { error: missing };

  try {
    await db
      .update(schema.contacts)
      .set({ status, updatedAt: new Date() })
      .where(inArray(schema.contacts.id, parsedIds.data));
  } catch {
    return { error: "Couldn't update the contacts. Please try again." };
  }

  revalidatePath("/contacts");
  return { success: true, count: parsedIds.data.length };
}

export async function bulkAddTag(
  ids: number[],
  tag: string
): Promise<BulkActionState> {
  await requireSession();

  const parsedIds = BulkIdsSchema.safeParse(ids);
  if (!parsedIds.success) return { error: "Invalid contact IDs." };

  const parsedTag = z
    .string()
    .trim()
    .max(60, "Tag is too long.")
    .safeParse(tag ?? "");
  if (!parsedTag.success) return { error: "Tag is too long." };

  const db = getDb();
  if (!db) return { noDb: true };
  const trimmed = parsedTag.data;
  if (!trimmed) return { error: "Tag cannot be empty." };

  const missing = await missingContactsError(db, parsedIds.data);
  if (missing) return { error: missing };

  // Append the tag in a single query, touching only rows that don't already
  // have it. `returning` gives us the exact count of contacts updated.
  let updatedRows: { id: number }[];
  try {
    updatedRows = await db
      .update(schema.contacts)
      .set({
        tags: sql`array_append(${schema.contacts.tags}, ${trimmed})`,
        updatedAt: new Date(),
      })
      .where(
        and(
          inArray(schema.contacts.id, parsedIds.data),
          sql`NOT (${trimmed} = ANY(${schema.contacts.tags}))`
        )
      )
      .returning({ id: schema.contacts.id });
  } catch {
    return { error: "Couldn't add the tag. Please try again." };
  }

  revalidatePath("/contacts");
  return { success: true, count: updatedRows.length };
}

export async function bulkChangeOwner(
  ids: number[],
  owner: string
): Promise<BulkActionState> {
  await requireSession();

  const parsedIds = BulkIdsSchema.safeParse(ids);
  if (!parsedIds.success) return { error: "Invalid contact IDs." };

  const parsedOwner = z
    .string()
    .trim()
    .max(120, "Owner name is too long.")
    .safeParse(owner ?? "");
  if (!parsedOwner.success) return { error: "Owner name is too long." };

  const db = getDb();
  if (!db) return { noDb: true };

  const missing = await missingContactsError(db, parsedIds.data);
  if (missing) return { error: missing };

  try {
    await db
      .update(schema.contacts)
      .set({ owner: parsedOwner.data || null, updatedAt: new Date() })
      .where(inArray(schema.contacts.id, parsedIds.data));
  } catch {
    return { error: "Couldn't change the owner. Please try again." };
  }

  revalidatePath("/contacts");
  return { success: true, count: parsedIds.data.length };
}

export async function bulkEnrollInSequence(
  ids: number[],
  sequenceId: number
): Promise<BulkActionState> {
  await requireSession();

  const parsedIds = BulkIdsSchema.safeParse(ids);
  if (!parsedIds.success) return { error: "Invalid contact IDs." };

  const db = getDb();
  if (!db) return { noDb: true };
  if (!Number.isInteger(sequenceId)) return { error: "Invalid sequence." };

  const sequence = await db
    .select({ id: schema.sequences.id })
    .from(schema.sequences)
    .where(eq(schema.sequences.id, sequenceId))
    .limit(1);
  if (sequence.length === 0) return { error: "Sequence not found." };

  const missing = await missingContactsError(db, parsedIds.data);
  if (missing) return { error: missing };

  // Single atomic insert: rows that would collide with an existing active
  // enrollment are skipped by the cse_active_unique_idx partial index instead
  // of aborting the batch. `returning` gives us the exact set of rows actually
  // inserted, so the newly-enrolled count is correct even under concurrent
  // enrolls — no check-then-insert race and no "try again" retry needed.
  let inserted: { contactId: number }[];
  try {
    inserted = await db
      .insert(schema.contactSequenceEnrollments)
      .values(parsedIds.data.map((contactId) => ({ contactId, sequenceId })))
      .onConflictDoNothing({
        target: [
          schema.contactSequenceEnrollments.contactId,
          schema.contactSequenceEnrollments.sequenceId,
        ],
        where: eq(schema.contactSequenceEnrollments.status, "active"),
      })
      .returning({ contactId: schema.contactSequenceEnrollments.contactId });
  } catch {
    return { error: "Couldn't enroll the contacts. Please try again." };
  }

  revalidatePath("/contacts");
  // count = newly enrolled; the remainder of the selection were already active.
  return { success: true, count: inserted.length };
}

// ─── AI: Find duplicate contacts ─────────────────────────────────────────────

export type DuplicatePair = {
  primaryId: number;
  primaryName: string;
  primaryEmail: string | null;
  primaryCompany: string | null;
  secondaryId: number;
  secondaryName: string;
  secondaryEmail: string | null;
  secondaryCompany: string | null;
  reason: string;
  confidence: "high" | "medium" | "low";
};

export type FindDuplicatesState = {
  pairs?: DuplicatePair[];
  error?: string;
  noDb?: boolean;
  noKey?: boolean;
};

type DupScanContact = {
  id: number;
  name: string;
  email: string | null;
  company: string | null;
  phone: string | null;
};

// Normalize an email to a stable grouping key, or null when absent.
function normEmailKey(email: string | null): string | null {
  if (!email) return null;
  const key = email.trim().toLowerCase();
  return key || null;
}

// Normalize a phone to its digits, or null when there aren't enough digits to
// match reliably — partial/garbage numbers must not collide as "duplicates".
function normPhoneKey(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 7 ? digits : null;
}

// Cheap, AI-free pass: cluster contacts that share an exact normalized email
// or phone (union-find, since email and phone links can chain records together)
// and emit high-confidence merge pairs. Each cluster collapses toward its most
// complete (tie-break: oldest) record, so the duplicates all merge into one
// canonical contact. Returns the pairs plus the set of contact ids it claimed,
// so the caller can exclude them from the AI fuzzy-match prompt.
function exactDuplicatePairs(contacts: DupScanContact[]): {
  pairs: DuplicatePair[];
  claimed: Set<number>;
} {
  const n = contacts.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => {
    let root = i;
    while (parent[root] !== root) root = parent[root];
    while (parent[i] !== root) {
      const next = parent[i];
      parent[i] = root;
      i = next;
    }
    return root;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  const emailFirst = new Map<string, number>();
  const phoneFirst = new Map<string, number>();
  contacts.forEach((c, i) => {
    const ek = normEmailKey(c.email);
    if (ek) {
      const prev = emailFirst.get(ek);
      if (prev === undefined) emailFirst.set(ek, i);
      else union(prev, i);
    }
    const pk = normPhoneKey(c.phone);
    if (pk) {
      const prev = phoneFirst.get(pk);
      if (prev === undefined) phoneFirst.set(pk, i);
      else union(prev, i);
    }
  });

  const clusters = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    const list = clusters.get(root);
    if (list) list.push(i);
    else clusters.set(root, [i]);
  }

  const completeness = (c: DupScanContact) =>
    (c.email ? 1 : 0) + (c.phone ? 1 : 0) + (c.company ? 1 : 0);

  const pairs: DuplicatePair[] = [];
  const claimed = new Set<number>();
  for (const idxs of clusters.values()) {
    if (idxs.length < 2) continue;
    const members = idxs
      .map((i) => contacts[i])
      .sort((a, b) => completeness(b) - completeness(a) || a.id - b.id);
    const primary = members[0];
    for (const m of members) claimed.add(m.id);

    const pe = normEmailKey(primary.email);
    const pp = normPhoneKey(primary.phone);
    for (const secondary of members.slice(1)) {
      const sameEmail = pe !== null && pe === normEmailKey(secondary.email);
      const samePhone = pp !== null && pp === normPhoneKey(secondary.phone);
      const reason =
        sameEmail && samePhone
          ? "Exact email and phone match"
          : sameEmail
            ? "Exact email match"
            : samePhone
              ? "Exact phone match"
              : "Exact email/phone match";
      pairs.push({
        primaryId: primary.id,
        primaryName: primary.name,
        primaryEmail: primary.email,
        primaryCompany: primary.company,
        secondaryId: secondary.id,
        secondaryName: secondary.name,
        secondaryEmail: secondary.email,
        secondaryCompany: secondary.company,
        reason,
        confidence: "high",
      });
    }
  }

  return { pairs, claimed };
}

export async function findDuplicateContacts(): Promise<FindDuplicatesState> {
  await requireSession();

  const limited = await checkAiRateLimit();
  if (limited) return { error: limited };

  const db = getDb();
  if (!db) return { noDb: true };
  if (!process.env.DEEPSEEK_API_KEY) return { noKey: true };

  // Cap the scan size so the prompt can't grow unbounded with the contact base
  // (context-window/cost/latency blowups). UI already handles partial results.
  const MAX_DUP_SCAN = 500;
  const allContacts = await db
    .select({
      id: schema.contacts.id,
      name: schema.contacts.name,
      email: schema.contacts.email,
      company: schema.contacts.company,
      phone: schema.contacts.phone,
    })
    .from(schema.contacts)
    .orderBy(desc(schema.contacts.updatedAt))
    .limit(MAX_DUP_SCAN);

  if (allContacts.length < 2) return { pairs: [] };

  // Catch exact email/phone duplicates server-side first — these are certain,
  // so there's no reason to spend AI tokens on them. Only the leftover contacts
  // (true fuzzy candidates: similar names, shared company, typo'd emails) go to
  // the model, which shrinks the prompt and the token bill.
  const { pairs: exactPairs, claimed } = exactDuplicatePairs(allContacts);
  const allRemaining = allContacts.filter((c) => !claimed.has(c.id));

  // Fewer than two contacts left to compare — nothing fuzzy to find, so skip
  // the AI call entirely and return whatever exact matches we found.
  if (allRemaining.length < 2) return { pairs: exactPairs };

  // Cap the fuzzy candidate list sent to the model. Prompt size and token cost
  // scale linearly with the remainder, so on large workspaces we'd otherwise
  // ship ~500 rows to DeepSeek. Contacts are ordered most-recently-updated
  // first, so this keeps the freshest records; the rest are skipped this pass.
  const FUZZY_CANDIDATE_CAP = 150;
  const remaining = allRemaining.slice(0, FUZZY_CANDIDATE_CAP);
  if (allRemaining.length > FUZZY_CANDIDATE_CAP) {
    console.info(
      `[findDuplicateContacts] capped fuzzy candidates to ${FUZZY_CANDIDATE_CAP} of ${allRemaining.length} unclaimed contacts`
    );
  }

  const contactList = remaining
    .map(
      (c) =>
        `ID:${c.id} | Name:${c.name} | Email:${c.email ?? ""} | Company:${c.company ?? ""} | Phone:${c.phone ?? ""}`
    )
    .join("\n");

  try {
    const raw = await chat(
      [
        {
          role: "system",
          content:
            'You are a CRM data quality expert. Given a list of contacts, identify likely duplicate pairs. A duplicate is: exact or near-exact email match, same full name with matching or similar company, or same phone number. Return JSON with one key "pairs" — an array of objects each with: "primaryId" (number, the older/more complete record to keep), "secondaryId" (number, the duplicate to merge away), "reason" (short string why they are duplicates, max 20 words), "confidence" ("high", "medium", or "low"). Each contact ID may appear in at most one pair. Return an empty pairs array if no duplicates found. Output only JSON.',
        },
        {
          role: "user",
          content: `Find duplicate contacts:\n\n${contactList}`,
        },
      ],
      { json: true }
    );

    const parsed = parseAiJson<{
      pairs: Array<{
        primaryId: unknown;
        secondaryId: unknown;
        reason: unknown;
        confidence: unknown;
      }>;
    }>(raw);
    if (!parsed || typeof parsed !== "object") {
      return { error: "AI returned an unexpected format. Please try again." };
    }

    const contactMap = new Map(allContacts.map((c) => [c.id, c]));
    // Seed with the exact-match pairs and treat their contacts as already
    // claimed, so a fuzzy AI suggestion can never re-pair a contact we've
    // already exact-matched (and each id still appears in at most one pair).
    const pairs: DuplicatePair[] = [...exactPairs];
    const seenIds = new Set<number>(claimed);

    const rawPairs = Array.isArray(parsed.pairs) ? parsed.pairs : [];
    for (const p of rawPairs) {
      if (!p || typeof p !== "object") continue;
      const primaryId = Number(p.primaryId);
      const secondaryId = Number(p.secondaryId);
      if (
        !Number.isInteger(primaryId) ||
        !Number.isInteger(secondaryId) ||
        primaryId === secondaryId ||
        seenIds.has(primaryId) ||
        seenIds.has(secondaryId)
      )
        continue;

      const primary = contactMap.get(primaryId);
      const secondary = contactMap.get(secondaryId);
      if (!primary || !secondary) continue;

      const confidence = (["high", "medium", "low"] as const).includes(
        p.confidence as "high" | "medium" | "low"
      )
        ? (p.confidence as "high" | "medium" | "low")
        : "medium";

      pairs.push({
        primaryId: primary.id,
        primaryName: primary.name,
        primaryEmail: primary.email,
        primaryCompany: primary.company,
        secondaryId: secondary.id,
        secondaryName: secondary.name,
        secondaryEmail: secondary.email,
        secondaryCompany: secondary.company,
        reason: String(p.reason ?? "").slice(0, 120),
        confidence,
      });

      seenIds.add(primaryId);
      seenIds.add(secondaryId);
    }

    return { pairs };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown AI error.";
    if (message.includes("DEEPSEEK_API_KEY")) return { noKey: true };
    return { error: message };
  }
}

// ─── Merge contacts ───────────────────────────────────────────────────────────

export type MergeContactsState = {
  success?: boolean;
  error?: string;
  noDb?: boolean;
};

export async function mergeContacts(
  primaryId: number,
  secondaryId: number
): Promise<MergeContactsState> {
  await requireSession();

  const db = getDb();
  if (!db) return { noDb: true };

  if (primaryId === secondaryId)
    return { error: "Cannot merge a contact with itself." };

  try {
    const rows = await db
      .select()
      .from(schema.contacts)
      .where(inArray(schema.contacts.id, [primaryId, secondaryId]));
    const primary = rows.find((r) => r.id === primaryId);
    const secondary = rows.find((r) => r.id === secondaryId);
    if (!primary || !secondary)
      return { error: "One or both contacts no longer exist." };

    // Backfill the primary's empty fields from the secondary and union tags so
    // no data is lost when the duplicate is removed.
    const mergedTags = Array.from(
      new Set([...(primary.tags ?? []), ...(secondary.tags ?? [])])
    );
    const mergedNotes =
      primary.notes && secondary.notes
        ? `${primary.notes}\n\n${secondary.notes}`
        : primary.notes ?? secondary.notes;

    // Backfill enrichment fields the primary lacks from the secondary so a merge
    // never discards a lead score, AI summary, or next action that only the
    // duplicate had. Paired fields (value + rationale + timestamp) move together
    // so we never pair a score with another contact's rationale.
    const leadScoreFields =
      primary.leadScore == null && secondary.leadScore != null
        ? {
            leadScore: secondary.leadScore,
            leadScoreRationale: secondary.leadScoreRationale,
            leadScoredAt: secondary.leadScoredAt,
          }
        : {};
    const aiSummaryFields =
      primary.aiSummary == null && secondary.aiSummary != null
        ? { aiSummary: secondary.aiSummary, aiSummaryAt: secondary.aiSummaryAt }
        : {};
    const nextActionFields =
      primary.nextAction == null && secondary.nextAction != null
        ? { nextAction: secondary.nextAction, nextActionAt: secondary.nextActionAt }
        : {};

    // Determine which of the secondary's sequence enrollments can move to the
    // primary, skipping sequences the primary is already actively enrolled in
    // (to avoid duplicate active rows). Enrollments left behind cascade-delete
    // with the secondary.
    const primaryActive = await db
      .select({ sequenceId: schema.contactSequenceEnrollments.sequenceId })
      .from(schema.contactSequenceEnrollments)
      .where(
        and(
          eq(schema.contactSequenceEnrollments.contactId, primaryId),
          eq(schema.contactSequenceEnrollments.status, "active")
        )
      );
    const primaryActiveSeqs = primaryActive.map((e) => e.sequenceId);
    const moveCondition =
      primaryActiveSeqs.length > 0
        ? and(
            eq(schema.contactSequenceEnrollments.contactId, secondaryId),
            notInArray(
              schema.contactSequenceEnrollments.sequenceId,
              primaryActiveSeqs
            )
          )
        : eq(schema.contactSequenceEnrollments.contactId, secondaryId);

    // Backfill the primary, reassign all related records, and delete the
    // secondary atomically — a mid-way failure must never leave orphaned or
    // duplicated data. neon-http has no interactive transactions, so batch()
    // commits all statements together in a single transaction.
    const now = new Date();
    await db.batch([
      db
        .update(schema.contacts)
        .set({
          email: primary.email ?? secondary.email,
          phone: primary.phone ?? secondary.phone,
          company: primary.company ?? secondary.company,
          title: primary.title ?? secondary.title,
          source: primary.source ?? secondary.source,
          owner: primary.owner ?? secondary.owner,
          notes: mergedNotes,
          tags: mergedTags,
          ...leadScoreFields,
          ...aiSummaryFields,
          ...nextActionFields,
          updatedAt: now,
        })
        .where(eq(schema.contacts.id, primaryId)),
      db
        .update(schema.activities)
        .set({ contactId: primaryId, updatedAt: now })
        .where(eq(schema.activities.contactId, secondaryId)),
      db
        .update(schema.deals)
        .set({ contactId: primaryId, updatedAt: now })
        .where(eq(schema.deals.contactId, secondaryId)),
      db
        .update(schema.contactSequenceEnrollments)
        .set({ contactId: primaryId })
        .where(moveCondition),
      db.delete(schema.contacts).where(eq(schema.contacts.id, secondaryId)),
    ]);

    revalidatePath("/contacts");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return { error: message };
  }
}

// ─── Per-contact AI result cache ──────────────────────────────────────────────
// Mirrors the deal-scoring cache: reuses the appSettings key/value store as a
// durable cache for per-contact AI results. Each entry stores the result
// alongside a fingerprint of the exact prompt inputs; an unchanged contact
// yields the same fingerprint, so the stored result is surfaced without
// re-calling DeepSeek. Survives restarts and ignores the in-memory LRU's TTL.

type AiCacheDb = NonNullable<ReturnType<typeof getDb>>;

function inputFingerprint(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

async function readAiResultCache<T>(
  db: AiCacheDb,
  key: string,
  fingerprint: string
): Promise<T | null> {
  try {
    const [row] = await db
      .select({ value: schema.appSettings.value })
      .from(schema.appSettings)
      .where(eq(schema.appSettings.key, key))
      .limit(1);
    if (!row) return null;
    const parsed = JSON.parse(row.value) as { fp?: unknown; data?: unknown };
    if (
      parsed &&
      parsed.fp === fingerprint &&
      parsed.data &&
      typeof parsed.data === "object"
    ) {
      return parsed.data as T;
    }
    return null;
  } catch {
    // Corrupt/legacy cache entry or read failure — treat as a miss.
    return null;
  }
}

async function writeAiResultCache(
  db: AiCacheDb,
  key: string,
  fingerprint: string,
  data: unknown
): Promise<void> {
  try {
    const now = new Date();
    const value = JSON.stringify({ fp: fingerprint, data });
    await db
      .insert(schema.appSettings)
      .values({ key, value })
      .onConflictDoUpdate({
        target: schema.appSettings.key,
        set: { value, updatedAt: now },
      });
  } catch {
    // Non-fatal — the AI result is still returned even if caching fails.
  }
}

export async function draftOutreachEmail(
  contactId: number
): Promise<DraftEmailState> {
  await requireSession();

  const limited = await checkAiRateLimit();
  if (limited) return { error: limited };

  if (!idSchema.safeParse(contactId).success) return { error: "Invalid contact id." };

  const db = getDb();
  if (!db) return { noDb: true };

  // Bail out before touching the DB when AI is unconfigured — avoids wasted reads.
  if (!process.env.DEEPSEEK_API_KEY) return { noKey: true };

  const [contact] = await db
    .select()
    .from(schema.contacts)
    .where(eq(schema.contacts.id, contactId))
    .limit(1);

  if (!contact) return { error: "Contact not found." };

  const lines = [
    `Name: ${contact.name}`,
    contact.title ? `Title: ${contact.title}` : null,
    contact.company ? `Company: ${contact.company}` : null,
    contact.email ? `Email: ${contact.email}` : null,
    contact.notes ? `Notes: ${contact.notes}` : null,
  ].filter(Boolean) as string[];

  // Serve a previously-drafted email when the contact's relevant inputs are
  // unchanged — avoids a redundant DeepSeek call (AI-efficiency mandate).
  const fingerprint = inputFingerprint(lines.join("\n"));
  const cacheKey = `aiDraft:contact:${contactId}`;
  const cached = await readAiResultCache<{ draft: string }>(
    db,
    cacheKey,
    fingerprint
  );
  if (cached && typeof cached.draft === "string" && cached.draft.trim()) {
    return { draft: cached.draft };
  }

  try {
    const draft = await chat([
      {
        role: "system",
        content:
          "You are a professional sales development representative. Draft concise, personalized outreach emails. Keep them under 200 words. Use a friendly but professional tone. Output only the email body — no subject line, no metadata.",
      },
      {
        role: "user",
        content: `Draft a personalized outreach email to this contact:\n\n${lines.join("\n")}`,
      },
    ]);
    // A blank completion is a successful call with no usable output — surface a
    // friendly error rather than leaving the panel on its idle hint.
    if (!draft.trim()) {
      return { error: "AI returned an empty draft. Please try again." };
    }
    // Persist keyed on the input fingerprint so an unchanged contact is served
    // from cache next time instead of re-calling DeepSeek.
    await writeAiResultCache(db, cacheKey, fingerprint, { draft });
    return { draft };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown AI error.";
    if (message.includes("DEEPSEEK_API_KEY")) return { noKey: true };
    return { error: message };
  }
}
