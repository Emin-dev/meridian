"use server";

import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { revalidatePath } from "next/cache";

export async function cancelEnrollmentFromSequence(
  enrollmentId: number,
  sequenceId: number
): Promise<void> {
  const db = getDb();
  if (!db) return;

  await db
    .update(schema.contactSequenceEnrollments)
    .set({ status: "cancelled" })
    .where(eq(schema.contactSequenceEnrollments.id, enrollmentId));

  revalidatePath(`/sequences/${sequenceId}`);
}

export async function markStepSent(
  enrollmentId: number,
  sequenceId: number,
  contactId: number,
  subject: string,
  body: string,
  newStepPosition: number,
  totalSteps: number,
): Promise<{ error?: string }> {
  const db = getDb();
  if (!db) return { error: "No database" };

  const isCompleted = newStepPosition >= totalSteps;

  await db.insert(schema.activities).values({
    type: "email",
    subject,
    body,
    contactId,
    completedAt: new Date(),
  });

  await db
    .update(schema.contactSequenceEnrollments)
    .set({
      currentStepPosition: newStepPosition,
      ...(isCompleted ? { status: "completed" as const } : {}),
    })
    .where(eq(schema.contactSequenceEnrollments.id, enrollmentId));

  revalidatePath(`/sequences/${sequenceId}`);
  revalidatePath(`/contacts/${contactId}`);
  revalidatePath("/sequences");
  return {};
}
