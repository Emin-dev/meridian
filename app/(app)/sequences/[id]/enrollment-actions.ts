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

  const [[sequence], [enrollment]] = await Promise.all([
    db
      .select({ status: schema.sequences.status })
      .from(schema.sequences)
      .where(eq(schema.sequences.id, sequenceId))
      .limit(1),
    db
      .select({
        status: schema.contactSequenceEnrollments.status,
        currentStepPosition:
          schema.contactSequenceEnrollments.currentStepPosition,
      })
      .from(schema.contactSequenceEnrollments)
      .where(eq(schema.contactSequenceEnrollments.id, enrollmentId))
      .limit(1),
  ]);

  if (!sequence || sequence.status !== "active") {
    return { error: "Sequence is paused" };
  }

  // Server-authoritative guard: only advance the step the client actually saw.
  // Protects against stale pages / double-clicks re-logging a sent step or
  // moving the position backward.
  if (!enrollment) return {};
  if (enrollment.status !== "active") {
    return { error: "Enrollment is no longer active" };
  }
  if (newStepPosition !== enrollment.currentStepPosition + 1) return {};

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
