"use server";

import { z } from "zod";
import { eq, desc, inArray, and, isNull, notInArray, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { chat } from "@/lib/ai";

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
  const db = getDb();
  if (!db) return { count: 0, skipped: [], error: "Database not connected" };

  if (!Array.isArray(rows) || rows.length === 0) {
    return { count: 0, skipped: [], error: "No rows to import" };
  }

  const MAX_IMPORT_ROWS = 1000;

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

  // Cap the batch so an oversized single insert can't exceed Postgres/Neon
  // parameter limits and fail the whole import. Rows beyond the cap are skipped.
  const rowsToProcess = normalized.slice(0, MAX_IMPORT_ROWS);
  for (const r of normalized.slice(MAX_IMPORT_ROWS)) {
    skipped.push({
      row: r.rowIndex,
      name: r.name || "(empty)",
      reason: "Exceeds import limit (max 1000 per batch)",
    });
  }

  for (const r of rowsToProcess) {
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
  const db = getDb();
  if (!db) return { noDb: true };

  const notes = String(formData.get("notes") ?? "").trim() || null;

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
  const db = getDb();
  if (!db) return;

  // Catch real DB/FK failures and surface a friendly message; the redirect()
  // below stays OUTSIDE the try so its control-flow signal is never swallowed.
  try {
    await db.delete(schema.contacts).where(eq(schema.contacts.id, id));
  } catch (err) {
    console.error("deleteContact failed:", err);
    throw new Error("Could not delete this contact — please try again.");
  }

  revalidatePath("/contacts");
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
    ]);

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
async function scoreContactFromData(
  db: NonNullable<ReturnType<typeof getDb>>,
  contact: typeof schema.contacts.$inferSelect,
  recentActivities: (typeof schema.activities.$inferSelect)[]
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

    let parsed: { score: unknown; rationale: unknown };
    try {
      parsed = JSON.parse(raw) as { score: unknown; rationale: unknown };
    } catch {
      return { error: "AI returned an unexpected format. Please try again." };
    }
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
    .limit(20);

  return scoreContactFromData(db, contact, recentActivities);
}

// ─── AI: Bulk lead scoring ────────────────────────────────────────────────────

export type BulkScoreState = {
  count?: number;
  failed?: number;
  error?: string;
  noDb?: boolean;
  noKey?: boolean;
};

export async function bulkScoreContacts(): Promise<BulkScoreState> {
  const db = getDb();
  if (!db) return { noDb: true };
  if (!process.env.DEEPSEEK_API_KEY) return { noKey: true };

  // Pre-fetch every unscored contact in a single query rather than re-querying
  // each contact inside scoreContact (which previously meant 101 queries for
  // 100 contacts).
  const contactsToScore = await db
    .select()
    .from(schema.contacts)
    .where(isNull(schema.contacts.leadScore));

  if (contactsToScore.length === 0) return { count: 0 };

  // Fetch the activities for all those contacts in one query, then group them
  // per contact (newest-first, capped at 20 to match scoreContact's behaviour).
  const contactIds = contactsToScore.map((c) => c.id);
  const activityRows = await db
    .select()
    .from(schema.activities)
    .where(inArray(schema.activities.contactId, contactIds))
    .orderBy(desc(schema.activities.createdAt));

  const activitiesByContact = new Map<number, typeof activityRows>();
  for (const a of activityRows) {
    if (a.contactId == null) continue;
    const list = activitiesByContact.get(a.contactId);
    if (list) {
      if (list.length < 20) list.push(a);
    } else {
      activitiesByContact.set(a.contactId, [a]);
    }
  }

  // Score with a small fixed concurrency so the batch finishes far faster than
  // the old one-at-a-time loop, while staying gentle on the DeepSeek API. A
  // per-contact try/catch keeps a single failure from aborting the whole batch.
  const CONCURRENCY = 4;
  const database = db;
  let count = 0;
  let failed = 0;
  let cursor = 0;

  async function worker() {
    while (cursor < contactsToScore.length) {
      const contact = contactsToScore[cursor++];
      try {
        const result = await scoreContactFromData(
          database,
          contact,
          activitiesByContact.get(contact.id) ?? []
        );
        if (result.score !== undefined) count++;
        else failed++;
      } catch {
        // Skip this contact; keep scoring the rest of the batch.
        failed++;
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, contactsToScore.length) }, () => worker())
  );

  revalidatePath("/contacts");
  return { count, failed };
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

    let parsed: {
      action: unknown;
      priority: unknown;
      rationale: unknown;
      suggestedMessage: unknown;
    };
    try {
      parsed = JSON.parse(raw) as {
        action: unknown;
        priority: unknown;
        rationale: unknown;
        suggestedMessage: unknown;
      };
    } catch {
      return { error: "AI returned an unexpected format. Please try again." };
    }
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

export async function enrichContact(contactId: number): Promise<EnrichState> {
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

    let parsed: {
      title: unknown;
      company: unknown;
      notes: unknown;
    };
    try {
      parsed = JSON.parse(raw) as {
        title: unknown;
        company: unknown;
        notes: unknown;
      };
    } catch {
      return { error: "AI returned an unexpected format. Please try again." };
    }
    if (!parsed || typeof parsed !== "object") {
      return { error: "AI returned an unexpected format. Please try again." };
    }

    return {
      title: String(parsed.title ?? "").trim(),
      company: String(parsed.company ?? "").trim(),
      notes: String(parsed.notes ?? "").trim(),
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

export async function applyContactEnrichment(
  contactId: number,
  fields: { title: string; company: string; notes: string }
): Promise<ApplyEnrichmentState> {
  const db = getDb();
  if (!db) return { noDb: true };

  try {
    await db
      .update(schema.contacts)
      .set({
        title: fields.title || null,
        company: fields.company || null,
        notes: fields.notes || null,
        updatedAt: new Date(),
      })
      .where(eq(schema.contacts.id, contactId));

    revalidatePath(`/contacts/${contactId}`);
    revalidatePath("/contacts");
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

export async function bulkChangeStatus(
  ids: number[],
  status: BulkContactStatus
): Promise<BulkActionState> {
  const db = getDb();
  if (!db) return { noDb: true };
  if (ids.length === 0) return { count: 0 };

  await db
    .update(schema.contacts)
    .set({ status, updatedAt: new Date() })
    .where(inArray(schema.contacts.id, ids));

  revalidatePath("/contacts");
  return { success: true, count: ids.length };
}

export async function bulkAddTag(
  ids: number[],
  tag: string
): Promise<BulkActionState> {
  const db = getDb();
  if (!db) return { noDb: true };
  if (ids.length === 0) return { count: 0 };
  const trimmed = tag.trim();
  if (!trimmed) return { error: "Tag cannot be empty." };

  // Append the tag in a single query, touching only rows that don't already
  // have it. `returning` gives us the exact count of contacts updated.
  const updatedRows = await db
    .update(schema.contacts)
    .set({
      tags: sql`array_append(${schema.contacts.tags}, ${trimmed})`,
      updatedAt: new Date(),
    })
    .where(
      and(
        inArray(schema.contacts.id, ids),
        sql`NOT (${trimmed} = ANY(${schema.contacts.tags}))`
      )
    )
    .returning({ id: schema.contacts.id });

  revalidatePath("/contacts");
  return { success: true, count: updatedRows.length };
}

export async function bulkChangeOwner(
  ids: number[],
  owner: string
): Promise<BulkActionState> {
  const parsedOwner = z
    .string()
    .trim()
    .max(120, "Owner name is too long.")
    .safeParse(owner ?? "");
  if (!parsedOwner.success) return { error: "Owner name is too long." };

  const db = getDb();
  if (!db) return { noDb: true };
  if (ids.length === 0) return { count: 0 };

  await db
    .update(schema.contacts)
    .set({ owner: parsedOwner.data || null, updatedAt: new Date() })
    .where(inArray(schema.contacts.id, ids));

  revalidatePath("/contacts");
  return { success: true, count: ids.length };
}

export async function bulkEnrollInSequence(
  ids: number[],
  sequenceId: number
): Promise<BulkActionState> {
  const db = getDb();
  if (!db) return { noDb: true };
  if (ids.length === 0) return { count: 0 };
  if (!Number.isInteger(sequenceId)) return { error: "Invalid sequence." };

  const existing = await db
    .select({ contactId: schema.contactSequenceEnrollments.contactId })
    .from(schema.contactSequenceEnrollments)
    .where(
      and(
        inArray(schema.contactSequenceEnrollments.contactId, ids),
        eq(schema.contactSequenceEnrollments.sequenceId, sequenceId),
        eq(schema.contactSequenceEnrollments.status, "active")
      )
    );

  const alreadyEnrolled = new Set(existing.map((e) => e.contactId));
  const toEnroll = ids.filter((id) => !alreadyEnrolled.has(id));

  if (toEnroll.length > 0) {
    await db
      .insert(schema.contactSequenceEnrollments)
      .values(toEnroll.map((contactId) => ({ contactId, sequenceId })));
  }

  revalidatePath("/contacts");
  return { success: true, count: toEnroll.length };
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

export async function findDuplicateContacts(): Promise<FindDuplicatesState> {
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
    .orderBy(schema.contacts.createdAt)
    .limit(MAX_DUP_SCAN);

  if (allContacts.length < 2) return { pairs: [] };

  const contactList = allContacts
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

    let parsed: {
      pairs: Array<{
        primaryId: unknown;
        secondaryId: unknown;
        reason: unknown;
        confidence: unknown;
      }>;
    };
    try {
      parsed = JSON.parse(raw) as {
        pairs: Array<{
          primaryId: unknown;
          secondaryId: unknown;
          reason: unknown;
          confidence: unknown;
        }>;
      };
    } catch {
      return { error: "AI returned an unexpected format. Please try again." };
    }
    if (!parsed || typeof parsed !== "object") {
      return { error: "AI returned an unexpected format. Please try again." };
    }

    const contactMap = new Map(allContacts.map((c) => [c.id, c]));
    const pairs: DuplicatePair[] = [];
    const seenIds = new Set<number>();

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

    await db
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
        updatedAt: new Date(),
      })
      .where(eq(schema.contacts.id, primaryId));

    // Reassign related records to the primary.
    await db
      .update(schema.activities)
      .set({ contactId: primaryId, updatedAt: new Date() })
      .where(eq(schema.activities.contactId, secondaryId));

    await db
      .update(schema.deals)
      .set({ contactId: primaryId, updatedAt: new Date() })
      .where(eq(schema.deals.contactId, secondaryId));

    // Move the secondary's sequence enrollments to the primary, except for
    // sequences the primary is already actively enrolled in (to avoid duplicate
    // active rows). Enrollments left behind cascade-delete with the secondary.
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
    await db
      .update(schema.contactSequenceEnrollments)
      .set({ contactId: primaryId })
      .where(moveCondition);

    await db
      .delete(schema.contacts)
      .where(eq(schema.contacts.id, secondaryId));

    revalidatePath("/contacts");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return { error: message };
  }
}

export async function draftOutreachEmail(
  contactId: number
): Promise<DraftEmailState> {
  const db = getDb();
  if (!db) return { noDb: true };

  const [contact] = await db
    .select()
    .from(schema.contacts)
    .where(eq(schema.contacts.id, contactId))
    .limit(1);

  if (!contact) return { error: "Contact not found." };

  if (!process.env.DEEPSEEK_API_KEY) return { noKey: true };

  const lines = [
    `Name: ${contact.name}`,
    contact.title ? `Title: ${contact.title}` : null,
    contact.company ? `Company: ${contact.company}` : null,
    contact.email ? `Email: ${contact.email}` : null,
    contact.notes ? `Notes: ${contact.notes}` : null,
  ].filter(Boolean);

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
    return { draft };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown AI error.";
    if (message.includes("DEEPSEEK_API_KEY")) return { noKey: true };
    return { error: message };
  }
}
