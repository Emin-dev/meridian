"use server";

import { getDb, schema } from "@/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type SequenceFormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  noDb?: boolean;
};

export async function createSequence(
  _prev: SequenceFormState,
  formData: FormData
): Promise<SequenceFormState> {
  const name = String(formData.get("name") ?? "").trim();

  const fieldErrors: Record<string, string[]> = {};
  if (!name) fieldErrors["name"] = ["Name is required"];

  type RawStep = { delayDays: number; subjectTemplate: string; bodyTemplate: string };
  const steps: RawStep[] = [];

  for (let i = 0; i < 5; i++) {
    const subject = String(formData.get(`step_${i}_subject`) ?? "").trim();
    const body = String(formData.get(`step_${i}_body`) ?? "").trim();
    const delayRaw = String(formData.get(`step_${i}_delay`) ?? "0");
    const delay = parseInt(delayRaw, 10);

    // Skip entirely empty step slots
    if (!subject && !body) continue;

    if (!subject) fieldErrors[`step_${i}_subject`] = ["Subject is required"];
    if (!body) fieldErrors[`step_${i}_body`] = ["Body is required"];
    if (isNaN(delay) || delay < 0) {
      fieldErrors[`step_${i}_delay`] = ["Delay must be 0 or more days"];
    } else {
      steps.push({ delayDays: delay, subjectTemplate: subject, bodyTemplate: body });
    }
  }

  if (steps.length === 0 && Object.keys(fieldErrors).length === 0) {
    return { error: "Add at least one step to the sequence." };
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const db = getDb();
  if (!db) return { noDb: true };

  const [seq] = await db
    .insert(schema.sequences)
    .values({ name })
    .returning({ id: schema.sequences.id });

  await db.insert(schema.sequenceSteps).values(
    steps.map((step, i) => ({
      sequenceId: seq.id,
      position: i + 1,
      delayDays: step.delayDays,
      subjectTemplate: step.subjectTemplate,
      bodyTemplate: step.bodyTemplate,
    }))
  );

  revalidatePath("/sequences");
  redirect("/sequences");
}

export async function updateSequenceStatus(
  id: number,
  status: "active" | "paused"
): Promise<{ error?: string }> {
  const db = getDb();
  if (!db) return { error: "Database not connected." };

  const { eq } = await import("drizzle-orm");
  await db
    .update(schema.sequences)
    .set({ status, updatedAt: new Date() })
    .where(eq(schema.sequences.id, id));

  revalidatePath("/sequences");
  return {};
}
