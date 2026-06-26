"use server";

import { z } from "zod";
import { getDb, schema } from "@/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { chat } from "@/lib/ai";
import { parseAiJson } from "@/lib/ai-json";
import { requireSession } from "@/lib/require-session";

export type SequenceFormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  noDb?: boolean;
};

const idSchema = z.coerce.number().int().positive();

export async function createSequence(
  _prev: SequenceFormState,
  formData: FormData
): Promise<SequenceFormState> {
  await requireSession();

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

  try {
    const [seq] = await db
      .insert(schema.sequences)
      .values({ name })
      .returning({ id: schema.sequences.id });

    if (!seq) return { error: "Couldn't create the sequence. Please try again." };

    try {
      await db.insert(schema.sequenceSteps).values(
        steps.map((step, i) => ({
          sequenceId: seq.id,
          position: i + 1,
          delayDays: step.delayDays,
          subjectTemplate: step.subjectTemplate,
          bodyTemplate: step.bodyTemplate,
        }))
      );
    } catch {
      // neon-http has no interactive transactions; roll back the orphan sequence by hand.
      try {
        await db.delete(schema.sequences).where(eq(schema.sequences.id, seq.id));
      } catch {
        // best-effort cleanup; surface the original failure regardless.
      }
      return { error: "Couldn't save the sequence steps. Please try again." };
    }
  } catch {
    return { error: "Couldn't create the sequence. Please try again." };
  }

  revalidatePath("/sequences");
  redirect("/sequences");
}

export type AIDraftResult = {
  name?: string;
  steps?: Array<{
    delayDays: number;
    subjectTemplate: string;
    bodyTemplate: string;
  }>;
  error?: string;
};

export async function generateSequenceWithAI(goal: string): Promise<AIDraftResult> {
  await requireSession();

  const parsedGoal = z
    .string()
    .trim()
    .min(1)
    .max(500)
    .safeParse(goal ?? "");
  if (!parsedGoal.success) {
    const tooLong = (goal ?? "").trim().length > 500;
    return {
      error: tooLong
        ? "Keep your goal under 500 characters."
        : "Please enter a goal.",
    };
  }

  try {
    const raw = await chat(
      [
        {
          role: "system",
          content: `You are a sales sequence designer. Given a goal, output a complete email sequence as valid JSON with this exact structure:
{
  "name": "sequence name",
  "steps": [
    {
      "delayDays": 0,
      "subjectTemplate": "subject using {{firstName}} where natural",
      "bodyTemplate": "email body using {{firstName}} and {{company}} as merge fields"
    }
  ]
}
Rules: max 5 steps, use {{firstName}} and {{company}} as merge fields, keep emails brief and conversational, first step has delayDays 0, subsequent steps spaced 3-7 days apart.`,
        },
        {
          role: "user",
          content: `Design an email sequence for this goal: ${parsedGoal.data}`,
        },
      ],
      { json: true }
    );

    const parsed = parseAiJson<{ name?: unknown; steps?: unknown }>(raw);
    if (!parsed) {
      return { error: "AI returned an unexpected format. Please try again." };
    }

    if (
      typeof parsed.name !== "string" ||
      !Array.isArray(parsed.steps) ||
      parsed.steps.length === 0
    ) {
      return { error: "AI returned an unexpected format. Please try again." };
    }

    const steps = (parsed.steps as unknown[]).slice(0, 5).map((s) => {
      const step = s as Record<string, unknown>;
      return {
        delayDays:
          typeof step.delayDays === "number" && Number.isInteger(step.delayDays)
            ? Math.max(0, step.delayDays)
            : 0,
        subjectTemplate:
          typeof step.subjectTemplate === "string" ? step.subjectTemplate : "",
        bodyTemplate:
          typeof step.bodyTemplate === "string" ? step.bodyTemplate : "",
      };
    });

    return { name: parsed.name, steps };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "AI generation failed." };
  }
}

export async function updateSequenceStatus(
  id: number,
  status: "active" | "paused"
): Promise<{ error?: string }> {
  await requireSession();

  if (!idSchema.safeParse(id).success) return { error: "Invalid sequence id." };

  const db = getDb();
  if (!db) return { error: "Database not connected." };

  try {
    await db
      .update(schema.sequences)
      .set({ status, updatedAt: new Date() })
      .where(eq(schema.sequences.id, id));
  } catch {
    return { error: "Couldn't update the sequence. Please try again." };
  }

  revalidatePath("/sequences");
  revalidatePath(`/sequences/${id}`);
  return {};
}
