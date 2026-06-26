"use server";

import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { chat } from "@/lib/ai";
import { parseAiJson } from "@/lib/ai-json";
import { numericEqual } from "@/lib/format";

import {
  WIN_LOSS_MARKER,
  extractUserNotes,
  extractWinLossInsight,
} from "./notes-utils";

// Validates an id-only argument coming from a client action call.
const idSchema = z.coerce.number().int().positive();

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
  value: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Enter a valid amount")
    .nullable(),
  expectedCloseDate: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), "Enter a valid date")
    .nullable(),
  // Reject non-numeric input with a friendly message, then clamp to 0–100 so an
  // out-of-range probability is corrected rather than failing the whole save.
  probability: z
    .number()
    .refine((n) => Number.isFinite(n), "Enter a valid probability")
    .transform((n) => Math.min(100, Math.max(0, Math.round(n)))),
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

  // Read current state before updating so we can detect changes.
  const [current] = await db
    .select({ stage: schema.deals.stage, notes: schema.deals.notes, value: schema.deals.value })
    .from(schema.deals)
    .where(eq(schema.deals.id, id))
    .limit(1);
  if (!current) return { error: "Deal not found." };

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

  // Log stage and value changes.
  if (current) {
    const events: Array<{ dealId: number; field: string; oldValue: string | null; newValue: string | null }> = [];
    if (current.stage !== parsed.data.stage) {
      events.push({ dealId: id, field: "stage", oldValue: current.stage, newValue: parsed.data.stage });
    }
    if (!numericEqual(current.value, parsed.data.value)) {
      events.push({ dealId: id, field: "value", oldValue: current.value ?? null, newValue: parsed.data.value ?? null });
    }
    if (events.length > 0) {
      await db.insert(schema.dealEvents).values(events);
    }
  }

  // Trigger AI win/loss analysis when the stage is newly changed to won or lost.
  const newStage = parsed.data.stage;
  const oldStage = current?.stage;
  const isClosing =
    (newStage === "won" || newStage === "lost") &&
    oldStage !== "won" &&
    oldStage !== "lost";

  if (isClosing && process.env.DEEPSEEK_API_KEY) {
    try {
      const insight = await _generateWinLossInsight(db, id, newStage);
      if (insight) {
        const userNotes = extractUserNotes(current?.notes ?? null);
        const newNotes = (userNotes ?? "") + WIN_LOSS_MARKER + insight;
        await db
          .update(schema.deals)
          .set({ notes: newNotes, updatedAt: new Date() })
          .where(eq(schema.deals.id, id));
      }
    } catch {
      // Non-critical — don't fail the save if the AI call errors.
    }
  }

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
  const userNotes = String(formData.get("notes") ?? "").trim() || null;

  const db = getDb();
  if (!db) return { noDb: true };

  // Re-read existing notes so we can preserve any AI win/loss insight that
  // was previously appended — user edits should not erase it.
  const [existing] = await db
    .select({ notes: schema.deals.notes })
    .from(schema.deals)
    .where(eq(schema.deals.id, id))
    .limit(1);
  if (!existing) return { error: "Deal not found." };

  const insight = extractWinLossInsight(existing?.notes ?? null);
  const finalNotes =
    userNotes
      ? userNotes + (insight ? WIN_LOSS_MARKER + insight : "")
      : insight
        ? WIN_LOSS_MARKER.trimStart() + insight
        : null;

  await db
    .update(schema.deals)
    .set({ notes: finalNotes, updatedAt: new Date() })
    .where(eq(schema.deals.id, id));

  revalidatePath(`/deals/${id}`);
  revalidatePath("/deals");
  return { success: true };
}

// ─── AI: Win/Loss analysis ────────────────────────────────────────────────────

type Db = NonNullable<ReturnType<typeof getDb>>;

async function _generateWinLossInsight(
  db: Db,
  dealId: number,
  closedAs: "won" | "lost"
): Promise<string | null> {
  const [deal] = await db
    .select()
    .from(schema.deals)
    .where(eq(schema.deals.id, dealId))
    .limit(1);

  if (!deal) return null;

  let contactInfo: string | null = null;
  if (deal.contactId) {
    const [c] = await db
      .select({
        name: schema.contacts.name,
        title: schema.contacts.title,
        company: schema.contacts.company,
        status: schema.contacts.status,
        leadScore: schema.contacts.leadScore,
      })
      .from(schema.contacts)
      .where(eq(schema.contacts.id, deal.contactId))
      .limit(1);
    if (c) {
      const parts = [
        c.name,
        c.title && c.company ? `${c.title} at ${c.company}` : c.company ?? c.title,
        c.status ? `status: ${c.status}` : null,
        c.leadScore != null ? `lead score: ${c.leadScore}` : null,
      ].filter(Boolean);
      contactInfo = parts.join(", ");
    }
  }

  const activities = await db
    .select()
    .from(schema.activities)
    .where(eq(schema.activities.dealId, dealId))
    .orderBy(desc(schema.activities.createdAt))
    .limit(15);

  const userNotes = extractUserNotes(deal.notes ?? null);

  const lines: string[] = [
    `Deal: ${deal.title}`,
    `Closed as: ${closedAs.toUpperCase()}`,
    deal.value ? `Value: ${deal.value} ${deal.currency}` : null,
    contactInfo ? `Contact: ${contactInfo}` : null,
    userNotes ? `\nNotes:\n${userNotes}` : null,
  ].filter(Boolean) as string[];

  if (activities.length > 0) {
    lines.push("\nActivity history (newest first):");
    for (const a of activities) {
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

  const insight = await chat([
    {
      role: "system",
      content:
        `You are a CRM analyst. A deal was just closed as ${closedAs.toUpperCase()}. ` +
        "Based on all available context — notes, contact profile, activity history — write a concise 2–4 sentence insight explaining the key reason(s) this deal closed the way it did. " +
        "Highlight patterns, decisive moments, or factors that made the difference. Be direct and specific.",
    },
    {
      role: "user",
      content: `Analyse why this deal was ${closedAs}:\n\n${lines.join("\n")}`,
    },
  ]);

  return insight.trim();
}

// Exported action so the client can trigger win/loss analysis on demand
// (e.g., for deals already in won/lost state that were closed before this feature).
export type WinLossAnalysisState = {
  insight?: string;
  error?: string;
  noDb?: boolean;
  noKey?: boolean;
};

export async function triggerWinLossAnalysis(
  dealId: number
): Promise<WinLossAnalysisState> {
  if (!process.env.DEEPSEEK_API_KEY) return { noKey: true };

  const db = getDb();
  if (!db) return { noDb: true };

  const [deal] = await db
    .select({ stage: schema.deals.stage, notes: schema.deals.notes })
    .from(schema.deals)
    .where(eq(schema.deals.id, dealId))
    .limit(1);

  if (!deal) return { error: "Deal not found." };
  if (deal.stage !== "won" && deal.stage !== "lost") {
    return { error: "Analysis is only available for won/lost deals." };
  }

  try {
    const insight = await _generateWinLossInsight(db, dealId, deal.stage);
    if (!insight) return { error: "AI returned an empty insight." };

    const userNotes = extractUserNotes(deal.notes ?? null);
    const newNotes = (userNotes ?? "") + WIN_LOSS_MARKER + insight;
    await db
      .update(schema.deals)
      .set({ notes: newNotes, updatedAt: new Date() })
      .where(eq(schema.deals.id, dealId));

    revalidatePath(`/deals/${dealId}`);
    return { insight };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown AI error.";
    if (msg.includes("DEEPSEEK_API_KEY")) return { noKey: true };
    return { error: msg };
  }
}

export async function deleteDeal(id: number): Promise<void> {
  if (!idSchema.safeParse(id).success) redirect("/deals");

  const db = getDb();
  if (db) {
    await db.delete(schema.deals).where(eq(schema.deals.id, id));
    revalidatePath("/deals");
  }
  redirect("/deals");
}

// ─── AI: Win-probability score ───────────────────────────────────────────────

export type DealScoreState = {
  score?: number;
  reasoning?: string;
  error?: string;
  noDb?: boolean;
  noKey?: boolean;
};

export async function scoreDeal(dealId: number): Promise<DealScoreState> {
  if (!idSchema.safeParse(dealId).success) return { error: "Invalid deal id." };

  const db = getDb();
  if (!db) return { noDb: true };

  const [deal] = await db
    .select()
    .from(schema.deals)
    .where(eq(schema.deals.id, dealId))
    .limit(1);

  if (!deal) return { error: "Deal not found." };

  if (!process.env.DEEPSEEK_API_KEY) return { noKey: true };

  let contactInfo: string | null = null;
  if (deal.contactId) {
    const [c] = await db
      .select({
        name: schema.contacts.name,
        title: schema.contacts.title,
        company: schema.contacts.company,
        status: schema.contacts.status,
        leadScore: schema.contacts.leadScore,
      })
      .from(schema.contacts)
      .where(eq(schema.contacts.id, deal.contactId))
      .limit(1);
    if (c) {
      const parts = [
        c.name,
        c.title && c.company
          ? `${c.title} at ${c.company}`
          : (c.company ?? c.title),
        c.status ? `status: ${c.status}` : null,
        c.leadScore != null ? `lead score: ${c.leadScore}` : null,
      ].filter(Boolean);
      contactInfo = parts.join(", ");
    }
  }

  const userNotes = extractUserNotes(deal.notes ?? null);

  const lines: string[] = [
    `Deal: ${deal.title}`,
    `Stage: ${deal.stage}`,
    deal.value ? `Value: ${deal.value} ${deal.currency}` : null,
    deal.expectedCloseDate
      ? `Expected close: ${deal.expectedCloseDate.toISOString().slice(0, 10)}`
      : null,
    contactInfo ? `Contact: ${contactInfo}` : null,
    userNotes ? `\nNotes:\n${userNotes}` : null,
  ].filter(Boolean) as string[];

  try {
    const raw = await chat(
      [
        {
          role: "system",
          content:
            'You are a sales analytics expert. Estimate the probability (0–100) that this deal will close as WON, based on stage, value, close date, contact profile, and notes. 0 = almost certainly lost, 100 = certain win. Return JSON with exactly two keys: "score" (integer 0–100) and "reasoning" (one paragraph, max 100 words, explaining the score). No other text.',
        },
        {
          role: "user",
          content: `Score the win probability of this deal:\n\n${lines.join("\n")}`,
        },
      ],
      { json: true }
    );

    const parsed = parseAiJson<{ score: unknown; reasoning: unknown }>(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { error: "AI returned an unexpected format. Please try again." };
    }
    const score = Math.round(Number(parsed.score));
    const reasoning = String(parsed.reasoning ?? "").trim();

    if (!Number.isFinite(score) || score < 0 || score > 100) {
      return { error: "AI returned an invalid score." };
    }

    try {
      await db
        .update(schema.deals)
        .set({ probability: score, updatedAt: new Date() })
        .where(eq(schema.deals.id, dealId));
      revalidatePath(`/deals/${dealId}`);
      revalidatePath("/deals");
    } catch {
      // Non-critical — don't fail if the DB update errors
    }

    return { score, reasoning };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown AI error.";
    if (message.includes("DEEPSEEK_API_KEY")) return { noKey: true };
    return { error: message };
  }
}

// ─── AI: Summarize deal ───────────────────────────────────────────────────────

export type DealSummarizeState = {
  summary?: string;
  summaryAt?: string;
  error?: string;
  noDb?: boolean;
  noKey?: boolean;
};

export async function summarizeDeal(dealId: number): Promise<DealSummarizeState> {
  if (!idSchema.safeParse(dealId).success) return { error: "Invalid deal id." };

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

    const summaryAt = new Date();

    // Cache result to the deal row (best-effort — columns may not exist yet)
    try {
      await db
        .update(schema.deals)
        .set({ aiSummary: summary, aiSummaryAt: summaryAt, updatedAt: new Date() })
        .where(eq(schema.deals.id, dealId));
      revalidatePath(`/deals/${dealId}`);
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

// ─── AI: Deal risk & next step ───────────────────────────────────────────────

export type DealRiskState = {
  risk?: "low" | "medium" | "high";
  reason?: string;
  nextStep?: string;
  error?: string;
  noDb?: boolean;
  noKey?: boolean;
};

export async function assessDealRisk(dealId: number): Promise<DealRiskState> {
  if (!idSchema.safeParse(dealId).success) return { error: "Invalid deal id." };

  const db = getDb();
  if (!db) return { noDb: true };

  const [deal] = await db
    .select()
    .from(schema.deals)
    .where(eq(schema.deals.id, dealId))
    .limit(1);

  if (!deal) return { error: "Deal not found." };

  if (!process.env.DEEPSEEK_API_KEY) return { noKey: true };

  let contactInfo: string | null = null;
  if (deal.contactId) {
    const [c] = await db
      .select({
        name: schema.contacts.name,
        title: schema.contacts.title,
        company: schema.contacts.company,
        status: schema.contacts.status,
        leadScore: schema.contacts.leadScore,
      })
      .from(schema.contacts)
      .where(eq(schema.contacts.id, deal.contactId))
      .limit(1);
    if (c) {
      const parts = [
        c.name,
        c.title && c.company
          ? `${c.title} at ${c.company}`
          : (c.company ?? c.title),
        c.status ? `status: ${c.status}` : null,
        c.leadScore != null ? `lead score: ${c.leadScore}` : null,
      ].filter(Boolean);
      contactInfo = parts.join(", ");
    }
  }

  const recentActivities = await db
    .select()
    .from(schema.activities)
    .where(eq(schema.activities.dealId, dealId))
    .orderBy(desc(schema.activities.createdAt))
    .limit(15);

  const userNotes = extractUserNotes(deal.notes ?? null);

  const lines: string[] = [
    `Deal: ${deal.title}`,
    `Stage: ${deal.stage}`,
    deal.value ? `Value: ${deal.value} ${deal.currency}` : null,
    deal.expectedCloseDate
      ? `Expected close: ${deal.expectedCloseDate.toISOString().slice(0, 10)}`
      : null,
    contactInfo ? `Contact: ${contactInfo}` : null,
    userNotes ? `\nNotes:\n${userNotes}` : null,
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
            'You are a sales pipeline risk analyst. Assess how at-risk this deal is of stalling or being lost, based on its stage, value, expected close date, contact profile, notes, and recent activity (including how recent or stale the last touch is). Return JSON with exactly three keys: "risk" ("low", "medium", or "high"), "reason" (a single concise sentence, max 20 words, naming the main driver of that risk level), and "nextStep" (one concrete, specific action the rep should take next, max 14 words, imperative). No other text.',
        },
        {
          role: "user",
          content: `Assess the risk and next step for this deal:\n\n${lines.join("\n")}`,
        },
      ],
      { json: true }
    );

    const parsed = parseAiJson<{
      risk: unknown;
      reason: unknown;
      nextStep: unknown;
    }>(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { error: "AI returned an unexpected format. Please try again." };
    }

    const risk = (["low", "medium", "high"] as const).includes(
      parsed.risk as "low" | "medium" | "high"
    )
      ? (parsed.risk as "low" | "medium" | "high")
      : "medium";
    const reason = String(parsed.reason ?? "").trim();
    const nextStep = String(parsed.nextStep ?? "").trim();

    if (!reason && !nextStep) {
      return { error: "AI returned an empty assessment." };
    }

    return { risk, reason, nextStep };
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
  suggestedAt?: string;
  error?: string;
  noDb?: boolean;
  noKey?: boolean;
};

export async function suggestDealNextAction(dealId: number): Promise<DealNextActionState> {
  if (!idSchema.safeParse(dealId).success) return { error: "Invalid deal id." };

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

    // Cache result to the deal row (best-effort — columns may not exist yet)
    try {
      await db
        .update(schema.deals)
        .set({
          nextAction: JSON.stringify({ action, priority, rationale, suggestedMessage }),
          nextActionAt: suggestedAt,
          updatedAt: new Date(),
        })
        .where(eq(schema.deals.id, dealId));
      revalidatePath(`/deals/${dealId}`);
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
