"use server";

import { getDb, schema } from "@/db";
import { insertDemoData } from "@/db/demo-data";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function loadDemoData(): Promise<{ error: string } | undefined> {
  const db = getDb();
  if (!db) {
    return { error: "Database not connected. Set DATABASE_URL first." };
  }

  const existing = await db
    .select({ id: schema.contacts.id })
    .from(schema.contacts)
    .limit(1);

  if (existing.length > 0) {
    return {
      error:
        "Your workspace already has contacts. Remove existing data before loading the demo.",
    };
  }

  await insertDemoData(db);
  revalidatePath("/", "layout");
  redirect("/dashboard");
}
