"use server";

import { z } from "zod";
import { eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { revalidatePath } from "next/cache";
import {
  WIN_LOSS_MARKER,
  extractUserNotes,
  extractWinLossInsight,
} from "./[id]/notes-utils";

const DEAL_STAGES = [
  "lead",
  "qualified",
  "proposal",
  "negotiation",
  "won",
  "lost",
] as const;

const STAGE_PROBABILITY: Record<string, number> = {
  lead: 10,
  qualified: 20,
  proposal: 50,
  negotiation: 75,
  won: 100,
  lost: 0,
};

const DealSchema = z.object({
  title: z.string().min(1, "Title is required"),
  stage: z.enum(DEAL_STAGES),
  value: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Enter a valid amount")
    .nullable(),
  currency: z.string().min(1, "Currency required").max(10),
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

  revalidatePath("/deals");
  return { success: true };
}

export async function moveDealStage(
  id: number,
  newStage: string,
  closeReason?: string
): Promise<{ error?: string; noDb?: boolean }> {
  const parsed = z.enum(DEAL_STAGES).safeParse(newStage);
  if (!parsed.success) return { error: "Invalid stage" };

  const db = getDb();
  if (!db) return { noDb: true };

  const [current] = await db
    .select({ stage: schema.deals.stage })
    .from(schema.deals)
    .where(eq(schema.deals.id, id))
    .limit(1);

  if (!current) return { error: "Deal not found" };

  const isTerminal = parsed.data === "won" || parsed.data === "lost";

  await db
    .update(schema.deals)
    .set({
      stage: parsed.data,
      probability: STAGE_PROBABILITY[parsed.data] ?? 10,
      closeReason: isTerminal ? (closeReason?.trim() || null) : null,
      updatedAt: new Date(),
    })
    .where(eq(schema.deals.id, id));

  if (current && current.stage !== parsed.data) {
    await db.insert(schema.dealEvents).values({
      dealId: id,
      field: "stage",
      oldValue: current.stage,
      newValue: parsed.data,
    });
  }

  revalidatePath("/deals");
  revalidatePath(`/deals/${id}`);
  return {};
}

type BulkActionResult = { error?: string; count?: number; noDb?: boolean };

const BulkIdsSchema = z.array(z.number().int().positive()).min(1);

const OwnerSchema = z.string().trim().max(120, "Owner name is too long.");

export async function bulkMoveStage(
  ids: number[],
  stage: string
): Promise<BulkActionResult> {
  const parsedIds = BulkIdsSchema.safeParse(ids);
  if (!parsedIds.success) return { error: "Invalid deal IDs." };
  const parsedStage = z.enum(DEAL_STAGES).safeParse(stage);
  if (!parsedStage.success) return { error: "Invalid stage." };

  const db = getDb();
  if (!db) return { noDb: true };

  await db
    .update(schema.deals)
    .set({
      stage: parsedStage.data,
      probability: STAGE_PROBABILITY[parsedStage.data] ?? 10,
      closeReason: null,
      updatedAt: new Date(),
    })
    .where(inArray(schema.deals.id, parsedIds.data));

  revalidatePath("/deals");
  return { count: parsedIds.data.length };
}

export async function bulkChangeOwner(
  ids: number[],
  owner: string
): Promise<BulkActionResult> {
  const parsedIds = BulkIdsSchema.safeParse(ids);
  if (!parsedIds.success) return { error: "Invalid deal IDs." };
  const parsedOwner = OwnerSchema.safeParse(owner ?? "");
  if (!parsedOwner.success) return { error: "Owner name is too long." };

  const db = getDb();
  if (!db) return { noDb: true };

  await db
    .update(schema.deals)
    .set({ owner: parsedOwner.data || null, updatedAt: new Date() })
    .where(inArray(schema.deals.id, parsedIds.data));

  revalidatePath("/deals");
  return { count: parsedIds.data.length };
}

export async function bulkDeleteDeals(
  ids: number[]
): Promise<BulkActionResult> {
  const parsedIds = BulkIdsSchema.safeParse(ids);
  if (!parsedIds.success) return { error: "Invalid deal IDs." };

  const db = getDb();
  if (!db) return { noDb: true };

  await db
    .delete(schema.deals)
    .where(inArray(schema.deals.id, parsedIds.data));

  revalidatePath("/deals");
  return { count: parsedIds.data.length };
}

export async function updateDeal(
  id: number,
  _prev: DealFormState,
  formData: FormData
): Promise<DealFormState> {
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
    .select({ stage: schema.deals.stage, value: schema.deals.value, notes: schema.deals.notes })
    .from(schema.deals)
    .where(eq(schema.deals.id, id))
    .limit(1);

  const { title, stage, value, currency, expectedCloseDate, contactId, notes, owner } =
    parsed.data;

  // Preserve any AI win/loss insight stored alongside the user notes — the edit
  // form only ever submits the user-authored portion, so re-attach the insight.
  const existingInsight = extractWinLossInsight(current?.notes ?? null);
  const submittedNotes = extractUserNotes(notes);
  const finalNotes = submittedNotes
    ? submittedNotes + (existingInsight ? WIN_LOSS_MARKER + existingInsight : "")
    : existingInsight
      ? WIN_LOSS_MARKER.trimStart() + existingInsight
      : null;

  await db
    .update(schema.deals)
    .set({
      title,
      stage,
      value: value,
      currency,
      expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : null,
      contactId: contactId,
      notes: finalNotes,
      owner: owner,
      updatedAt: new Date(),
    })
    .where(eq(schema.deals.id, id));

  if (current) {
    const events: Array<{ dealId: number; field: string; oldValue: string | null; newValue: string | null }> = [];
    if (current.stage !== stage) {
      events.push({ dealId: id, field: "stage", oldValue: current.stage, newValue: stage });
    }
    if (!_numericEqual(current.value, value)) {
      events.push({ dealId: id, field: "value", oldValue: current.value ?? null, newValue: value ?? null });
    }
    if (events.length > 0) {
      await db.insert(schema.dealEvents).values(events);
    }
  }

  revalidatePath("/deals");
  return { success: true };
}

function _numericEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  const an = a ?? null, bn = b ?? null;
  if (an === null && bn === null) return true;
  if (an === null || bn === null) return false;
  const fa = parseFloat(an), fb = parseFloat(bn);
  return (isNaN(fa) || isNaN(fb)) ? an === bn : fa === fb;
}
