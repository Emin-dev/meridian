"use server";

import { getDb, schema } from "@/db";
import { revalidatePath } from "next/cache";
import { and, asc, eq, gt, sql } from "drizzle-orm";
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

  revalidatePath(`/sequences/${sequenceId}`);
  return {};
}

export async function reorderStep(
  stepId: number,
  sequenceId: number,
  direction: "up" | "down"
): Promise<{ error?: string }> {
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

  await db
    .update(schema.sequenceSteps)
    .set({ position: swap.position })
    .where(eq(schema.sequenceSteps.id, current.id));
  await db
    .update(schema.sequenceSteps)
    .set({ position: current.position })
    .where(eq(schema.sequenceSteps.id, swap.id));

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
            "You are a sales email copywriter. Output valid JSON only with keys subjectTemplate and bodyTemplate. Use {{firstName}} and {{company}} as merge fields where natural. Keep emails brief and conversational.",
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
