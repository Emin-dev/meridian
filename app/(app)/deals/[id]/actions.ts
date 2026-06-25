"use server";

import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { chat } from "@/lib/ai";

// ─── Update deal details (title, stage, value, close date) ───────────────────

const DEAL_STAGES = [
  "lead",
  "qualified",
  "proposal",
  "negotiation",
  "won",
  "lost",
] as const;

const DealDetailsSchema = z.object({
  title: z.string().min(1, "Title is required"),
  stage: z.enum(DEAL_STAGES),
  value: z.string().nullable(),
  expectedCloseDate: z.string().nullable(),
  probability: z.number().int().min(0).max(100),
});

export type DealDetailsState = {
  error?: string;
  fieldErrors?: Partial<
    Record<"title" | "stage" | "value" | "expectedCloseDate" | "probability", string[]>
  >;
  success?: boolean;
  noDb?: boolean;
};

export async function updateDealDetails(
  id: number,
  _prev: DealDetailsState,
  formData: FormData
): Promise<DealDetailsState> {
  const valueRaw = String(formData.get("value") ?? "").trim();
  const dateRaw = String(formData.get("expectedCloseDate") ?? "").trim();
  const probabilityRaw = String(formData.get("probability") ?? "10").trim();

  const raw = {
    title: String(formData.get("title") ?? "").trim(),
    stage: String(formData.get("stage") ?? "lead"),
    value: valueRaw === "" ? null : valueRaw,
    expectedCloseDate: dateRaw === "" ? null : dateRaw,
    probability: probabilityRaw === "" ? 10 : parseInt(probabilityRaw, 10),
  };

  const parsed = DealDetailsSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten()
        .fieldErrors as DealDetailsState["fieldErrors"],
    };
  }

  const db = getDb();
  if (!db) return { noDb: true };

  await db
    .update(schema.deals)
    .set({
      title: parsed.data.title,
      stage: parsed.data.stage,
      value: parsed.data.value,
      probability: parsed.data.probability,
      expectedCloseDate: parsed.data.expectedCloseDate
        ? new Date(parsed.data.expectedCloseDate)
        : null,
      updatedAt: new Date(),
    })
    .where(eq(schema.deals.id, id));

  revalidatePath(`/deals/${id}`);
  revalidatePath("/deals");
  return { success: true };
}

// ─── Notes ───────────────────────────────────────────────────────────────────

export type UpdateNotesState = {
  error?: string;
  success?: boolean;
  noDb?: boolean;
};

export async function updateDealNotes(
  id: number,
  _prev: UpdateNotesState,
  formData: FormData
): Promise<UpdateNotesState> {
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const db = getDb();
  if (!db) return { noDb: true };

  await db
    .update(schema.deals)
    .set({ notes, updatedAt: new Date() })
    .where(eq(schema.deals.id, id));

  revalidatePath(`/deals/${id}`);
  revalidatePath("/deals");
  return { success: true };
}

export async function deleteDeal(id: number): Promise<void> {
  const db = getDb();
  if (db) {
    await db.delete(schema.deals).where(eq(schema.deals.id, id));
    revalidatePath("/deals");
  }
  redirect("/deals");
}

// ─── AI: Summarize deal ───────────────────────────────────────────────────────

export type DealSummarizeState = {
  summary?: string;
  error?: string;
  noDb?: boolean;
  noKey?: boolean;
};

export async function summarizeDeal(dealId: number): Promise<DealSummarizeState> {
  const db = getDb();
  if (!db) return { noDb: true };

  const [deal] = await db
    .select()
    .from(schema.deals)
    .where(eq(schema.deals.id, dealId))
    .limit(1);

  if (!deal) return { error: "Deal not found." };

  if (!process.env.DEEPSEEK_API_KEY) return { noKey: true };

  let contactName: string | null = null;
  if (deal.contactId) {
    const [c] = await db
      .select({ name: schema.contacts.name })
      .from(schema.contacts)
      .where(eq(schema.contacts.id, deal.contactId))
      .limit(1);
    contactName = c?.name ?? null;
  }

  const recentActivities = await db
    .select()
    .from(schema.activities)
    .where(eq(schema.activities.dealId, dealId))
    .orderBy(desc(schema.activities.createdAt))
    .limit(10);

  const lines: string[] = [
    `Deal: ${deal.title}`,
    `Stage: ${deal.stage}`,
    deal.value ? `Value: ${deal.value} ${deal.currency}` : null,
    deal.expectedCloseDate
      ? `Expected close: ${deal.expectedCloseDate.toISOString().slice(0, 10)}`
      : null,
    contactName ? `Contact: ${contactName}` : null,
    deal.notes ? `\nNotes:\n${deal.notes}` : null,
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
  }

  try {
    const summary = await chat([
      {
        role: "system",
        content:
          "You are a CRM assistant. Given a deal's details, stage, value, linked contact, and recent activity, write a concise 3–5 sentence brief summarising the deal status, key risks or opportunities, and any critical next steps. Be direct and factual.",
      },
      {
        role: "user",
        content: `Summarise this deal:\n\n${lines.join("\n")}`,
      },
    ]);
    return { summary };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown AI error.";
    if (message.includes("DEEPSEEK_API_KEY")) return { noKey: true };
    return { error: message };
  }
}

// ─── AI: Suggest next action for deal ────────────────────────────────────────

export type DealNextActionState = {
  action?: string;
  priority?: "high" | "medium" | "low";
  rationale?: string;
  suggestedMessage?: string;
  error?: string;
  noDb?: boolean;
  noKey?: boolean;
};

export async function suggestDealNextAction(dealId: number): Promise<DealNextActionState> {
  const db = getDb();
  if (!db) return { noDb: true };

  const [deal] = await db
    .select()
    .from(schema.deals)
    .where(eq(schema.deals.id, dealId))
    .limit(1);

  if (!deal) return { error: "Deal not found." };

  if (!process.env.DEEPSEEK_API_KEY) return { noKey: true };

  let contactName: string | null = null;
  if (deal.contactId) {
    const [c] = await db
      .select({ name: schema.contacts.name })
      .from(schema.contacts)
      .where(eq(schema.contacts.id, deal.contactId))
      .limit(1);
    contactName = c?.name ?? null;
  }

  const recentActivities = await db
    .select()
    .from(schema.activities)
    .where(eq(schema.activities.dealId, dealId))
    .orderBy(desc(schema.activities.createdAt))
    .limit(15);

  const lines: string[] = [
    `Deal: ${deal.title}`,
    `Stage: ${deal.stage}`,
    deal.value ? `Value: ${deal.value} ${deal.currency}` : null,
    deal.expectedCloseDate
      ? `Expected close: ${deal.expectedCloseDate.toISOString().slice(0, 10)}`
      : null,
    contactName ? `Contact: ${contactName}` : null,
    deal.notes ? `\nNotes:\n${deal.notes}` : null,
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
            'You are an expert sales strategist. Given a CRM deal\'s details, stage, value, contact, and recent activities, recommend the single best next action the sales rep should take to advance or close the deal. Return JSON with exactly four keys: "action" (short imperative phrase, max 8 words), "priority" ("high", "medium", or "low"), "rationale" (one or two sentences explaining why this action now), and "suggestedMessage" (a ready-to-send short message or email the rep can copy, 60–120 words). No other text.',
        },
        {
          role: "user",
          content: `Suggest the next best action for this deal:\n\n${lines.join("\n")}`,
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
