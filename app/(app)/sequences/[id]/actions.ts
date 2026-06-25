"use server";

import { getDb, schema } from "@/db";
import { revalidatePath } from "next/cache";
import { eq, asc } from "drizzle-orm";
import { chat } from "@/lib/ai";

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

export type DraftStepResult = {
  subjectTemplate?: string;
  bodyTemplate?: string;
  error?: string;
};

export async function draftStepContent(
  sequenceName: string,
  stepPosition: number
): Promise<DraftStepResult> {
  try {
    const raw = await chat(
      [
        {
          role: "system",
          content:
            "You are a sales email copywriter. Output valid JSON only with keys subjectTemplate and bodyTemplate. Use {{first_name}} and {{company}} as merge fields where natural. Keep emails brief and conversational.",
        },
        {
          role: "user",
          content: `Write step ${stepPosition} of a sales outreach email sequence called "${sequenceName}". Return JSON with subjectTemplate and bodyTemplate.`,
        },
      ],
      { json: true }
    );
    const parsed = JSON.parse(raw) as {
      subjectTemplate?: unknown;
      bodyTemplate?: unknown;
    };
    if (
      typeof parsed.subjectTemplate !== "string" ||
      typeof parsed.bodyTemplate !== "string"
    ) {
      return { error: "AI returned incomplete content." };
    }
    return {
      subjectTemplate: parsed.subjectTemplate,
      bodyTemplate: parsed.bodyTemplate,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "AI draft failed." };
  }
}
