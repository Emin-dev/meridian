"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/require-session";

const idSchema = z.coerce.number().int().positive();

export type EnrollmentState = {
  error?: string;
  success?: boolean;
  noDb?: boolean;
};

export async function enrollInSequence(
  contactId: number,
  sequenceId: number
): Promise<EnrollmentState> {
  await requireSession();

  if (
    !idSchema.safeParse(contactId).success ||
    !idSchema.safeParse(sequenceId).success
  ) {
    return { error: "Invalid request." };
  }

  const db = getDb();
  if (!db) return { noDb: true };

  const existing = await db
    .select({ id: schema.contactSequenceEnrollments.id })
    .from(schema.contactSequenceEnrollments)
    .where(
      and(
        eq(schema.contactSequenceEnrollments.contactId, contactId),
        eq(schema.contactSequenceEnrollments.sequenceId, sequenceId),
        eq(schema.contactSequenceEnrollments.status, "active")
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return { error: "Already enrolled in this sequence." };
  }

  const sequence = await db
    .select({ id: schema.sequences.id })
    .from(schema.sequences)
    .where(eq(schema.sequences.id, sequenceId))
    .limit(1);

  if (sequence.length === 0) {
    return { error: "Sequence not found." };
  }

  try {
    await db
      .insert(schema.contactSequenceEnrollments)
      .values({ contactId, sequenceId });
  } catch {
    // Don't crash the route on a transient DB/constraint error; surface it so
    // the user can retry — the contact simply stays unenrolled.
    return { error: "Couldn't enroll the contact. Please try again." };
  }

  revalidatePath(`/contacts/${contactId}`);
  return { success: true };
}

export async function cancelEnrollment(
  enrollmentId: number,
  contactId: number
): Promise<{ error?: string }> {
  await requireSession();

  if (
    !idSchema.safeParse(enrollmentId).success ||
    !idSchema.safeParse(contactId).success
  ) {
    return { error: "Invalid request." };
  }

  const db = getDb();
  if (!db) return { error: "No database connected." };

  try {
    await db
      .update(schema.contactSequenceEnrollments)
      .set({ status: "cancelled" })
      .where(eq(schema.contactSequenceEnrollments.id, enrollmentId));
  } catch {
    // Surface a transient DB error instead of tripping the route error
    // boundary; the enrollment simply stays active and the user can retry.
    return { error: "Couldn't cancel the enrollment. Please try again." };
  }

  revalidatePath(`/contacts/${contactId}`);
  return {};
}
