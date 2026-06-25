"use server";

import { getDb, schema } from "@/db";
import { insertDemoData } from "@/db/demo-data";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const VALID_CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY"] as const;
const VALID_STAGES = [
  "lead",
  "qualified",
  "proposal",
  "negotiation",
  "won",
  "lost",
] as const;

const PreferencesSchema = z.object({
  displayName: z.string().max(100),
  defaultCurrency: z.enum(VALID_CURRENCIES),
  defaultDealStage: z.enum(VALID_STAGES),
});

export type PreferencesFormState = {
  error?: string;
  success?: boolean;
  noDb?: boolean;
};

export async function savePreferences(
  _prev: PreferencesFormState,
  formData: FormData
): Promise<PreferencesFormState> {
  const db = getDb();
  if (!db) return { noDb: true };

  const raw = {
    displayName: String(formData.get("displayName") ?? "").trim(),
    defaultCurrency: String(formData.get("defaultCurrency") ?? "USD"),
    defaultDealStage: String(formData.get("defaultDealStage") ?? "lead"),
  };

  const parsed = PreferencesSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Invalid settings values." };
  }

  const { displayName, defaultCurrency, defaultDealStage } = parsed.data;
  const updates: { key: string; value: string }[] = [
    { key: "displayName", value: displayName },
    { key: "defaultCurrency", value: defaultCurrency },
    { key: "defaultDealStage", value: defaultDealStage },
  ];

  for (const { key, value } of updates) {
    await db
      .insert(schema.appSettings)
      .values({ key, value })
      .onConflictDoUpdate({
        target: schema.appSettings.key,
        set: { value, updatedAt: new Date() },
      });
  }

  revalidatePath("/settings");
  return { success: true };
}

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
