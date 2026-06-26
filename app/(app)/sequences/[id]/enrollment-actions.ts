"use server";

import { count, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { revalidatePath } from "next/cache";

export async function cancelEnrollmentFromSequence(
  enrollmentId: number,
  sequenceId: number
): Promise<{ error?: string }> {
  const db = getDb();
  if (!db) return { error: "No database connected." };

  try {
    await db
      .update(schema.contactSequenceEnrollments)
      .set({ status: "cancelled" })
      .where(eq(schema.contactSequenceEnrollments.id, enrollmentId));

    revalidatePath(`/sequences/${sequenceId}`);
  } catch {
    // Don't crash the route on a transient DB error; surface it so the user
    // can retry — the enrollment simply stays active.
    return { error: "Couldn't cancel the enrollment. Please try again." };
  }

  return {};
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

  try {
    const [[sequence], [enrollment], [stepCountRow]] = await Promise.all([
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
      // Authoritative step count — the completion decision must not trust the
      // client-supplied totalSteps, which can be stale if steps were added or
      // removed after the page rendered (premature or missed "completed").
      db
        .select({ value: count() })
        .from(schema.sequenceSteps)
        .where(eq(schema.sequenceSteps.sequenceId, sequenceId)),
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

    const actualTotalSteps = stepCountRow?.value ?? totalSteps;
    const isCompleted = newStepPosition >= actualTotalSteps;

    // Log the email and advance the step atomically so a partial failure can't
    // leave a logged activity without an advanced position (which a retry would
    // then duplicate, since the step-position guard above would still pass).
    await db.batch([
      db.insert(schema.activities).values({
        type: "email",
        subject,
        body,
        contactId,
        completedAt: new Date(),
      }),
      db
        .update(schema.contactSequenceEnrollments)
        .set({
          currentStepPosition: newStepPosition,
          ...(isCompleted ? { status: "completed" as const } : {}),
        })
        .where(eq(schema.contactSequenceEnrollments.id, enrollmentId)),
    ]);
  } catch {
    return { error: "Couldn't log the step. Please try again." };
  }

  revalidatePath(`/sequences/${sequenceId}`);
  revalidatePath(`/contacts/${contactId}`);
  revalidatePath("/sequences");
  return {};
}
