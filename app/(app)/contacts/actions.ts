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

  revalidatePath("/contacts");
  return { success: true };
}

const CsvRowSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().or(z.literal("")).transform((v) => (v === "" ? null : v)),
  phone: z.string().transform((v) => (v.trim() === "" ? null : v.trim())),
  company: z.string().transform((v) => (v.trim() === "" ? null : v.trim())),
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

  const MAX_IMPORT_ROWS = 1000;

  const skipped: ImportSkippedRow[] = [];
  const valid: Array<{ rowIndex: number; data: z.infer<typeof CsvRowSchema> }> = [];

  // Cap the batch so an oversized single insert can't exceed Postgres/Neon
  // parameter limits and fail the whole import. Rows beyond the cap are skipped.
  const rowsToProcess = rows.slice(0, MAX_IMPORT_ROWS);
  for (const r of rows.slice(MAX_IMPORT_ROWS)) {
    skipped.push({
      row: r.rowIndex,
      name: r.name || "(empty)",
      reason: "Exceeds import limit (max 1000 per batch)",
    });
  }

  for (const r of rowsToProcess) {
    const result = CsvRowSchema.safeParse(r);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      let reason = "Invalid data";
      if (firstIssue?.path[0] === "name") reason = "Missing name";
      else if (firstIssue?.path[0] === "email") reason = "Invalid email format";
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

  const existingEmails = new Set<string>();
  if (emailsToCheck.length > 0) {
    const existing = await db
      .select({ email: schema.contacts.email })
      .from(schema.contacts)
      .where(inArray(schema.contacts.email, emailsToCheck));
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
    await db.insert(schema.contacts).values(toInsert);
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

  await db
    .update(schema.contacts)
    .set({ notes, updatedAt: new Date() })
    .where(eq(schema.contacts.id, id));

  revalidatePath(`/contacts/${id}`);
  revalidatePath("/contacts");
  return { success: true };
}

export async function deleteContact(id: number): Promise<void> {
  const db = getDb();
  if (!db) return;

  await db.delete(schema.contacts).where(eq(schema.contacts.id, id));
  revalidatePath("/contacts");
  redirect("/contacts");
}

// ─── AI: Summarize contact notes & activity ──────────────────────────────────

export type SummarizeState = {
  summary?: string;
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
    return { summary };
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

    const parsed = JSON.parse(raw) as { score: unknown; rationale: unknown };
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
        .where(eq(schema.contacts.id, contactId));
      revalidatePath(`/contacts/${contactId}`);
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

// ─── AI: Bulk lead scoring ────────────────────────────────────────────────────

export type BulkScoreState = {
  count?: number;
  error?: string;
  noDb?: boolean;
  noKey?: boolean;
};

export async function bulkScoreContacts(): Promise<BulkScoreState> {
  const db = getDb();
  if (!db) return { noDb: true };
  if (!process.env.DEEPSEEK_API_KEY) return { noKey: true };

  const rows = await db
    .select({ id: schema.contacts.id })
    .from(schema.contacts)
    .where(isNull(schema.contacts.leadScore));

  if (rows.length === 0) return { count: 0 };

  let count = 0;
  for (const { id } of rows) {
    const result = await scoreContact(id);
    if (result.score !== undefined) count++;
  }

  revalidatePath("/contacts");
  return { count };
}

// ─── AI: Next best action suggestion ─────────────────────────────────────────

export type NextActionState = {
  action?: string;
  priority?: "high" | "medium" | "low";
  rationale?: string;
  suggestedMessage?: string;
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

    const parsed = JSON.parse(raw) as {
      action: unknown;
      priority: unknown;
      rationale: unknown;
      suggestedMessage: unknown;
    };

    const action = String(parsed.action ?? "").trim();
    const priority = (["high", "medium", "low"] as const).includes(
      parsed.priority as "high" | "medium" | "low"
    )
      ? (parsed.priority as "high" | "medium" | "low")
      : "medium";
    const rationale = String(parsed.rationale ?? "").trim();
    const suggestedMessage = String(parsed.suggestedMessage ?? "").trim();

    if (!action) return { error: "AI returned an empty action." };

    return { action, priority, rationale, suggestedMessage };
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

    const parsed = JSON.parse(raw) as {
      title: unknown;
      company: unknown;
      notes: unknown;
    };

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
  const db = getDb();
  if (!db) return { noDb: true };
  if (ids.length === 0) return { count: 0 };

  await db
    .update(schema.contacts)
    .set({ owner: owner.trim() || null, updatedAt: new Date() })
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

  const allContacts = await db
    .select({
      id: schema.contacts.id,
      name: schema.contacts.name,
      email: schema.contacts.email,
      company: schema.contacts.company,
      phone: schema.contacts.phone,
    })
    .from(schema.contacts)
    .orderBy(schema.contacts.createdAt);

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

    const parsed = JSON.parse(raw) as {
      pairs: Array<{
        primaryId: unknown;
        secondaryId: unknown;
        reason: unknown;
        confidence: unknown;
      }>;
    };

    const contactMap = new Map(allContacts.map((c) => [c.id, c]));
    const pairs: DuplicatePair[] = [];
    const seenIds = new Set<number>();

    for (const p of parsed.pairs ?? []) {
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
