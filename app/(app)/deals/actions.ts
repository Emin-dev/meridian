"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { revalidatePath } from "next/cache";

const DEAL_STAGES = [
  "lead",
  "qualified",
  "proposal",
  "negotiation",
  "won",
  "lost",
] as const;

const DealSchema = z.object({
  title: z.string().min(1, "Title is required"),
  stage: z.enum(DEAL_STAGES),
  value: z.string().nullable(),
  currency: z.string().min(1, "Currency required").max(10),
  expectedCloseDate: z.string().nullable(),
  contactId: z.number().int().nullable(),
  notes: z.string().nullable(),
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
      | "notes",
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

  const { title, stage, value, currency, expectedCloseDate, contactId, notes } =
    parsed.data;

  await db.insert(schema.deals).values({
    title,
    stage,
    value: value ?? undefined,
    currency,
    expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : undefined,
    contactId: contactId ?? undefined,
    notes: notes ?? undefined,
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

  const isTerminal = parsed.data === "won" || parsed.data === "lost";

  await db
    .update(schema.deals)
    .set({
      stage: parsed.data,
      closeReason: isTerminal ? (closeReason?.trim() || null) : null,
      updatedAt: new Date(),
    })
    .where(eq(schema.deals.id, id));

  revalidatePath("/deals");
  revalidatePath(`/deals/${id}`);
  return {};
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

  const { title, stage, value, currency, expectedCloseDate, contactId, notes } =
    parsed.data;

  await db
    .update(schema.deals)
    .set({
      title,
      stage,
      value: value,
      currency,
      expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : null,
      contactId: contactId,
      notes: notes,
      updatedAt: new Date(),
    })
    .where(eq(schema.deals.id, id));

  revalidatePath("/deals");
  return { success: true };
}
