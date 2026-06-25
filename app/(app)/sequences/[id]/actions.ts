"use server";

import { getDb, schema } from "@/db";
import { revalidatePath } from "next/cache";
import { eq, asc } from "drizzle-orm";

export type StepFormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  noDb?: boolean;
  success?: boolean;
};

export async function addStep(
  sequenceId: number,
  _prev: StepFormState,
  formData: FormData
): Promise<StepFormState> {
  const subject = String(formData.get("subjectTemplate") ?? "").trim();
  const body = String(formData.get("bodyTemplate") ?? "").trim();
  const delayRaw = String(formData.get("delayDays") ?? "0");
  const delay = parseInt(delayRaw, 10);

  const fieldErrors: Record<string, string[]> = {};
  if (!subject) fieldErrors["subjectTemplate"] = ["Subject is required"];
  if (!body) fieldErrors["bodyTemplate"] = ["Body is required"];
  if (isNaN(delay) || delay < 0)
    fieldErrors["delayDays"] = ["Delay must be 0 or more days"];

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const db = getDb();
  if (!db) return { noDb: true };

  const existing = await db
    .select({ position: schema.sequenceSteps.position })
    .from(schema.sequenceSteps)
    .where(eq(schema.sequenceSteps.sequenceId, sequenceId))
    .orderBy(asc(schema.sequenceSteps.position));

  const nextPosition = existing.length > 0 ? existing[existing.length - 1].position + 1 : 1;

  await db.insert(schema.sequenceSteps).values({
    sequenceId,
    position: nextPosition,
    delayDays: delay,
    subjectTemplate: subject,
    bodyTemplate: body,
  });

  revalidatePath(`/sequences/${sequenceId}`);
  return { success: true };
}

export async function updateStep(
  stepId: number,
  sequenceId: number,
  _prev: StepFormState,
  formData: FormData
): Promise<StepFormState> {
  const subject = String(formData.get("subjectTemplate") ?? "").trim();
  const body = String(formData.get("bodyTemplate") ?? "").trim();
  const delayRaw = String(formData.get("delayDays") ?? "0");
  const delay = parseInt(delayRaw, 10);

  const fieldErrors: Record<string, string[]> = {};
  if (!subject) fieldErrors["subjectTemplate"] = ["Subject is required"];
  if (!body) fieldErrors["bodyTemplate"] = ["Body is required"];
  if (isNaN(delay) || delay < 0)
    fieldErrors["delayDays"] = ["Delay must be 0 or more days"];

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const db = getDb();
  if (!db) return { noDb: true };

  await db
    .update(schema.sequenceSteps)
    .set({ subjectTemplate: subject, bodyTemplate: body, delayDays: delay })
    .where(eq(schema.sequenceSteps.id, stepId));

  revalidatePath(`/sequences/${sequenceId}`);
  return { success: true };
}

export async function deleteStep(
  stepId: number,
  sequenceId: number
): Promise<{ error?: string }> {
  const db = getDb();
  if (!db) return { error: "Database not connected." };

  await db
    .delete(schema.sequenceSteps)
    .where(eq(schema.sequenceSteps.id, stepId));

  // Re-number remaining steps by position order
  const remaining = await db
    .select({ id: schema.sequenceSteps.id })
    .from(schema.sequenceSteps)
    .where(eq(schema.sequenceSteps.sequenceId, sequenceId))
    .orderBy(asc(schema.sequenceSteps.position));

  for (let i = 0; i < remaining.length; i++) {
    await db
      .update(schema.sequenceSteps)
      .set({ position: i + 1 })
      .where(eq(schema.sequenceSteps.id, remaining[i].id));
  }

  revalidatePath(`/sequences/${sequenceId}`);
  return {};
}
