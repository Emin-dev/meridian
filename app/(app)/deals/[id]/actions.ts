"use server";

import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type UpdateNotesState = {
  error?: string;
  success?: boolean;
  noDb?: boolean;
};

export async function updateDealNotes(
  id: number,
  _prev: UpdateNotesState,
  formData: FormData
): Promise<UpdateNotesState> {
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const db = getDb();
  if (!db) return { noDb: true };

  await db
    .update(schema.deals)
    .set({ notes, updatedAt: new Date() })
    .where(eq(schema.deals.id, id));

  revalidatePath(`/deals/${id}`);
  revalidatePath("/deals");
  return { success: true };
}

export async function deleteDeal(id: number): Promise<void> {
  const db = getDb();
  if (db) {
    await db.delete(schema.deals).where(eq(schema.deals.id, id));
    revalidatePath("/deals");
  }
  redirect("/deals");
}
