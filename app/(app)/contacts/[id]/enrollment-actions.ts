"use server";

import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { revalidatePath } from "next/cache";

export type EnrollmentState = {
  error?: string;
  success?: boolean;
  noDb?: boolean;
};

export async function enrollInSequence(
  contactId: number,
  sequenceId: number
): Promise<EnrollmentState> {
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

  await db
    .insert(schema.contactSequenceEnrollments)
    .values({ contactId, sequenceId });

  revalidatePath(`/contacts/${contactId}`);
  return { success: true };
}

export async function cancelEnrollment(
  enrollmentId: number,
  contactId: number
): Promise<void> {
  const db = getDb();
  if (!db) return;

  await db
    .update(schema.contactSequenceEnrollments)
    .set({ status: "cancelled" })
    .where(eq(schema.contactSequenceEnrollments.id, enrollmentId));

  revalidatePath(`/contacts/${contactId}`);
}
