"use server";

import { getDb, schema } from "@/db";
import { revalidatePath } from "next/cache";
import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { chat } from "@/lib/ai";
import { parseAiJson } from "@/lib/ai-json";
import { requireSession } from "@/lib/require-session";

const reorderSchema = z.object({
  stepId: z.number().int().positive(),
  sequenceId: z.number().int().positive(),
  direction: z.enum(["up", "down"]),
});

// A step delay is a whole number of days within a sane bound; the client input
// is capped to the same range so this is the server-side enforcement of it.
export const MAX_DELAY_DAYS = 365;
const delaySchema = z.coerce.number().int().min(0).max(MAX_DELAY_DAYS);

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
  await requireSession();

  const idSchema = z.coerce.number().int().positive();
  if (!idSchema.safeParse(sequenceId).success) return { error: "Invalid sequence id." };

  const subject = String(formData.get("subjectTemplate") ?? "").trim();
  const body = String(formData.get("bodyTemplate") ?? "").trim();
  const delayParsed = delaySchema.safeParse(formData.get("delayDays") ?? "0");

  const fieldErrors: Record<string, string[]> = {};
  if (!subject) fieldErrors["subjectTemplate"] = ["Subject is required"];
  if (!body) fieldErrors["bodyTemplate"] = ["Body is required"];
  if (!delayParsed.success)
    fieldErrors["delayDays"] = [`Delay must be a whole number between 0 and ${MAX_DELAY_DAYS} days`];

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const delay = delayParsed.success ? delayParsed.data : 0;

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
  await requireSession();

  const idSchema = z.coerce.number().int().positive();
  if (!idSchema.safeParse(stepId).success || !idSchema.safeParse(sequenceId).success) {
    return { error: "Invalid request." };
  }

  const subject = String(formData.get("subjectTemplate") ?? "").trim();
  const body = String(formData.get("bodyTemplate") ?? "").trim();
  const delayParsed = delaySchema.safeParse(formData.get("delayDays") ?? "0");

  const fieldErrors: Record<string, string[]> = {};
  if (!subject) fieldErrors["subjectTemplate"] = ["Subject is required"];
  if (!body) fieldErrors["bodyTemplate"] = ["Body is required"];
  if (!delayParsed.success)
    fieldErrors["delayDays"] = [`Delay must be a whole number between 0 and ${MAX_DELAY_DAYS} days`];

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const delay = delayParsed.success ? delayParsed.data : 0;

  const db = getDb();
  if (!db) return { noDb: true };

  try {
    await db
      .update(schema.sequenceSteps)
      .set({ subjectTemplate: subject, bodyTemplate: body, delayDays: delay })
      .where(eq(schema.sequenceSteps.id, stepId));
  } catch {
    return { error: "Couldn't update the step. Please try again." };
  }

  revalidatePath(`/sequences/${sequenceId}`);
  return { success: true };
}

export async function deleteStep(
  stepId: number,
  sequenceId: number
): Promise<{ error?: string }> {
  await requireSession();

  const idSchema = z.coerce.number().int().positive();
  if (!idSchema.safeParse(stepId).success || !idSchema.safeParse(sequenceId).success) {
    return { error: "Invalid request." };
  }

  const db = getDb();
  if (!db) return { error: "Database not connected." };

  try {
    const [target] = await db
      .select({ position: schema.sequenceSteps.position })
      .from(schema.sequenceSteps)
      .where(eq(schema.sequenceSteps.id, stepId))
      .limit(1);

    if (!target) return {};

    await db
      .delete(schema.sequenceSteps)
      .where(eq(schema.sequenceSteps.id, stepId));

    // Close the gap: positions are kept contiguous (1..n), so shift every
    // later step down by one in a single statement instead of N round-trips.
    await db
      .update(schema.sequenceSteps)
      .set({ position: sql`${schema.sequenceSteps.position} - 1` })
      .where(
        and(
          eq(schema.sequenceSteps.sequenceId, sequenceId),
          gt(schema.sequenceSteps.position, target.position),
        ),
      );
  } catch {
    return { error: "Couldn't delete the step. Please try again." };
  }

  revalidatePath(`/sequences/${sequenceId}`);
  return {};
}

export async function reorderStep(
  stepId: number,
  sequenceId: number,
  direction: "up" | "down"
): Promise<{ error?: string }> {
  await requireSession();

  const parsed = reorderSchema.safeParse({ stepId, sequenceId, direction });
  if (!parsed.success) return { error: "Invalid reorder request." };

  const db = getDb();
  if (!db) return { error: "Database not connected." };

  const steps = await db
    .select({ id: schema.sequenceSteps.id, position: schema.sequenceSteps.position })
    .from(schema.sequenceSteps)
    .where(eq(schema.sequenceSteps.sequenceId, sequenceId))
    .orderBy(asc(schema.sequenceSteps.position));

  const idx = steps.findIndex((s) => s.id === stepId);
  if (idx === -1) return { error: "Step not found." };

  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= steps.length) return {};

  const current = steps[idx];
  const swap = steps[swapIdx];

  // Swap the two positions in a single statement so the update is atomic and
  // free of the race where one UPDATE lands but the other doesn't.
  await db
    .update(schema.sequenceSteps)
    .set({
      position: sql`CASE
        WHEN ${schema.sequenceSteps.id} = ${current.id} THEN ${swap.position}
        WHEN ${schema.sequenceSteps.id} = ${swap.id} THEN ${current.position}
        ELSE ${schema.sequenceSteps.position}
      END`,
    })
    .where(inArray(schema.sequenceSteps.id, [current.id, swap.id]));

  revalidatePath(`/sequences/${sequenceId}`);
  return {};
}

export type DraftStepResult = {
  subjectTemplate?: string;
  bodyTemplate?: string;
  error?: string;
};

const draftStepSchema = z.object({
  sequenceName: z.string().trim().min(1).max(120),
  stepPosition: z.number().int().positive().max(50),
});

export async function draftStepContent(
  sequenceName: string,
  stepPosition: number
): Promise<DraftStepResult> {
  await requireSession();

  const parsedInput = draftStepSchema.safeParse({ sequenceName, stepPosition });
  if (!parsedInput.success) return { error: "Invalid step details." };

  try {
    const raw = await chat(
      [
        {
          role: "system",
          content:
            "You are a sales email copywriter. Output valid JSON only with keys subjectTemplate and bodyTemplate. Use {{firstName}} and {{company}} as merge fields where natural. Keep emails brief and conversational.",
        },
        {
          role: "user",
          content: `Write step ${parsedInput.data.stepPosition} of a sales outreach email sequence called "${parsedInput.data.sequenceName}". Return JSON with subjectTemplate and bodyTemplate.`,
        },
      ],
      { json: true }
    );
    const parsed = parseAiJson<{
      subjectTemplate?: unknown;
      bodyTemplate?: unknown;
    }>(raw);
    if (
      !parsed ||
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
