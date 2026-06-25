"use server";

import { z } from "zod";
import { eq, desc, inArray, and, isNull } from "drizzle-orm";
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

export async function bulkImportContacts(
  rows: { name: string; email: string; phone: string; company: string }[]
): Promise<{ count: number; error?: string }> {
  const db = getDb();
  if (!db) return { count: 0, error: "Database not connected" };

  const valid = rows
    .map((r) => CsvRowSchema.safeParse(r))
    .filter((r) => r.success)
    .map((r) => (r as { success: true; data: z.infer<typeof CsvRowSchema> }).data);

  if (valid.length === 0) return { count: 0, error: "No valid rows to import" };

  await db.insert(schema.contacts).values(valid).onConflictDoNothing();
  revalidatePath("/contacts");
  return { count: valid.length };
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

  const rows = await db
    .select({ id: schema.contacts.id, tags: schema.contacts.tags })
    .from(schema.contacts)
    .where(inArray(schema.contacts.id, ids));

  let updated = 0;
  for (const contact of rows) {
    if (!contact.tags.includes(trimmed)) {
      await db
        .update(schema.contacts)
        .set({ tags: [...contact.tags, trimmed], updatedAt: new Date() })
        .where(eq(schema.contacts.id, contact.id));
      updated++;
    }
  }

  revalidatePath("/contacts");
  return { success: true, count: updated };
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
