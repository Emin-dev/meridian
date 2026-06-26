"use server";

import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { revalidatePath } from "next/cache";
import { chat } from "@/lib/ai";
import { parseAiJson } from "@/lib/ai-json";

const AddActivitySchema = z.object({
  type: z.enum(["call", "email", "meeting", "note", "task"]),
  subject: z.string().min(1, "Subject is required"),
  body: z.string().transform((v) => (v.trim() === "" ? null : v)),
  contactId: z.string().transform((v) => {
    const n = parseInt(v, 10);
    return Number.isInteger(n) ? n : null;
  }),
  dealId: z.string().transform((v) => {
    const n = parseInt(v, 10);
    return Number.isInteger(n) ? n : null;
  }),
  dueAt: z
    .string()
    .transform((v) => (v.trim() === "" ? null : new Date(v))),
  completedAt: z
    .string()
    .transform((v) => (v === "on" ? new Date() : null)),
});

export type AddActivityState = {
  error?: string;
  fieldErrors?: Partial<Record<"type" | "subject" | "body", string[]>>;
  success?: boolean;
  noDb?: boolean;
};

export async function addActivity(
  _prev: AddActivityState,
  formData: FormData
): Promise<AddActivityState> {
  const raw = {
    type: String(formData.get("type") ?? "note"),
    subject: String(formData.get("subject") ?? ""),
    body: String(formData.get("body") ?? ""),
    contactId: String(formData.get("contactId") ?? ""),
    dealId: String(formData.get("dealId") ?? ""),
    dueAt: String(formData.get("dueAt") ?? ""),
    completedAt: String(formData.get("completedAt") ?? ""),
  };

  const parsed = AddActivitySchema.safeParse(raw);
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten()
        .fieldErrors as AddActivityState["fieldErrors"],
    };
  }

  const db = getDb();
  if (!db) return { noDb: true };

  try {
    await db.insert(schema.activities).values({
      type: parsed.data.type,
      subject: parsed.data.subject,
      body: parsed.data.body,
      contactId: parsed.data.contactId,
      dealId: parsed.data.dealId,
      dueAt: parsed.data.dueAt,
      completedAt: parsed.data.completedAt,
    });
  } catch (err) {
    console.error("addActivity: failed to insert activity", err);
    revalidatePath("/activity");
    return { error: "Couldn't log the activity. Please try again." };
  }

  revalidatePath("/activity");
  if (parsed.data.contactId) {
    revalidatePath(`/contacts/${parsed.data.contactId}`);
  }
  if (parsed.data.dealId) {
    revalidatePath(`/deals/${parsed.data.dealId}`);
  }

  return { success: true };
}

export async function logAiTaskSuggestion(
  subject: string,
  contactId: number | null,
  dealId: number | null,
  body?: string | null,
  type?: "call" | "email" | "meeting" | "note" | "task",
): Promise<{ success?: boolean; error?: string; noDb?: boolean }> {
  const parsedSubject = z
    .string()
    .trim()
    .min(1)
    .max(200)
    .safeParse(subject ?? "");
  if (!parsedSubject.success) return { error: "Subject is required" };

  const db = getDb();
  if (!db) return { noDb: true };

  try {
    await db.insert(schema.activities).values({
      type: type ?? "task",
      subject: parsedSubject.data,
      body: body?.trim().slice(0, 2000) || null,
      contactId: contactId ?? null,
      dealId: dealId ?? null,
      dueAt: new Date(),
    });
  } catch {
    return { error: "Couldn't save the task. Please try again." };
  }

  revalidatePath("/tasks");
  revalidatePath("/activity");
  if (contactId) revalidatePath(`/contacts/${contactId}`);
  if (dealId) revalidatePath(`/deals/${dealId}`);

  return { success: true };
}

// ─── AI: Smart compose — draft a polished message from a short intent ─────────

export type SmartComposeState = {
  draft?: string;
  error?: string;
  noKey?: boolean;
};

const COMPOSE_TONE: Record<string, string> = {
  email: "a concise, professional email (with a greeting and sign-off)",
  call: "brief call talking points / a short script",
  meeting: "a short, friendly meeting request or agenda note",
  note: "a clear internal CRM note",
  task: "a clear, actionable task description",
};

export async function smartCompose(
  intent: string,
  type?: string,
): Promise<SmartComposeState> {
  const parsedIntent = z
    .string()
    .trim()
    .min(1)
    .max(1000)
    .safeParse(intent ?? "");
  if (!parsedIntent.success) {
    const tooLong = (intent ?? "").trim().length > 1000;
    return {
      error: tooLong
        ? "Keep your intent under 1000 characters."
        : "Describe what you want to say first.",
    };
  }
  const trimmed = parsedIntent.data;
  if (!process.env.DEEPSEEK_API_KEY) return { noKey: true };

  const format =
    (type && COMPOSE_TONE[type]) ?? "a polished, professional message";

  try {
    const draft = await chat([
      {
        role: "system",
        content:
          `You are a CRM writing assistant. Turn the user's short intent into ${format}. ` +
          "Keep it natural, warm and to the point — no fluff, no placeholder brackets unless a real name is unknown. " +
          "Return only the message text, with no preamble, labels, or quotation marks.",
      },
      {
        role: "user",
        content: `Draft a message for this intent:\n\n${trimmed}`,
      },
    ]);

    const clean = draft.trim();
    if (!clean) return { error: "The assistant returned an empty draft." };
    return { draft: clean };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown AI error.";
    if (message.includes("DEEPSEEK_API_KEY")) return { noKey: true };
    return { error: message };
  }
}

export async function toggleActivityComplete(
  activityId: number,
  isCompleted: boolean,
  contactId: number | null,
  dealId: number | null,
): Promise<{ error?: string }> {
  if (!z.coerce.number().int().positive().safeParse(activityId).success) {
    return { error: "Invalid activity id" };
  }

  const db = getDb();
  if (!db) return { error: "No database" };

  try {
    await db
      .update(schema.activities)
      .set({
        completedAt: isCompleted ? null : new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.activities.id, activityId));
  } catch {
    return { error: "Couldn't update the task. Please try again." };
  }

  revalidatePath("/activity");
  revalidatePath("/dashboard");
  revalidatePath("/analytics");
  if (contactId) revalidatePath(`/contacts/${contactId}`);
  if (dealId) revalidatePath(`/deals/${dealId}`);

  return {};
}

// ─── AI: Extract action items from notes + activity ───────────────────────────

type ActionItemType = "call" | "email" | "meeting" | "task";

export type ActionItem = {
  title: string;
  type: ActionItemType;
  rationale?: string;
};

export type ExtractActionItemsState = {
  items?: ActionItem[];
  error?: string;
  noDb?: boolean;
  noKey?: boolean;
};

export async function extractActionItems(
  contactId: number | null,
  dealId: number | null,
): Promise<ExtractActionItemsState> {
  if (!process.env.DEEPSEEK_API_KEY) return { noKey: true };

  const db = getDb();
  if (!db) return { noDb: true };

  let notes: string | null = null;
  let entityLabel = "";

  if (contactId) {
    const [contact] = await db
      .select({ name: schema.contacts.name, notes: schema.contacts.notes })
      .from(schema.contacts)
      .where(eq(schema.contacts.id, contactId))
      .limit(1);
    if (!contact) return { error: "Contact not found." };
    notes = contact.notes ?? null;
    entityLabel = `Contact: ${contact.name}`;
  } else if (dealId) {
    const [deal] = await db
      .select({ title: schema.deals.title, notes: schema.deals.notes })
      .from(schema.deals)
      .where(eq(schema.deals.id, dealId))
      .limit(1);
    if (!deal) return { error: "Deal not found." };
    notes = deal.notes ?? null;
    entityLabel = `Deal: ${deal.title}`;
  } else {
    return { error: "Must provide contactId or dealId." };
  }

  const activities = await db
    .select()
    .from(schema.activities)
    .where(
      contactId
        ? eq(schema.activities.contactId, contactId)
        : eq(schema.activities.dealId, dealId!),
    )
    .orderBy(desc(schema.activities.createdAt))
    .limit(20);

  const lines: string[] = [entityLabel];

  if (notes?.trim()) {
    lines.push(`\nNotes:\n${notes.trim()}`);
  }

  if (activities.length > 0) {
    lines.push("\nRecent activity (newest first):");
    for (const a of activities) {
      const date = a.createdAt.toISOString().slice(0, 10);
      const parts = [`[${date}] ${a.type.toUpperCase()}: ${a.subject}`, a.body ?? null].filter(Boolean);
      lines.push(`- ${parts.join(" — ")}`);
    }
  }

  if (!notes?.trim() && activities.length === 0) {
    return { items: [] };
  }

  try {
    const raw = await chat(
      [
        {
          role: "system",
          content:
            'You are a CRM assistant. From the provided notes and recent activity log, extract 2–5 concrete follow-up action items the sales rep should take. Return JSON with exactly one key: "items", an array where each element has: "title" (short imperative phrase, max 10 words), "type" (one of "call", "email", "meeting", "task"), and "rationale" (one sentence explaining why this action is needed). Only extract items clearly implied or explicitly mentioned in the content. Return an empty array if nothing actionable is found.',
        },
        {
          role: "user",
          content: `Extract follow-up action items from this CRM context:\n\n${lines.join("\n")}`,
        },
      ],
      { json: true },
    );

    const parsed = parseAiJson<{ items: unknown }>(raw);
    if (!parsed || !Array.isArray(parsed.items)) return { items: [] };

    const VALID_TYPES: ActionItemType[] = ["call", "email", "meeting", "task"];
    const items: ActionItem[] = parsed.items
      .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      .map((item) => ({
        title: String(item.title ?? "").trim(),
        type: VALID_TYPES.includes(item.type as ActionItemType)
          ? (item.type as ActionItemType)
          : "task",
        rationale: item.rationale ? String(item.rationale).trim() : undefined,
      }))
      .filter((item) => item.title.length > 0);

    return { items };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown AI error.";
    if (message.includes("DEEPSEEK_API_KEY")) return { noKey: true };
    return { error: message };
  }
}
