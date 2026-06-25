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
