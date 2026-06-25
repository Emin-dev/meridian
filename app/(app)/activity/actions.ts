"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { revalidatePath } from "next/cache";

const AddActivitySchema = z.object({
  type: z.enum(["call", "email", "meeting", "note", "task"]),
  subject: z.string().min(1, "Subject is required"),
  body: z.string().transform((v) => (v.trim() === "" ? null : v)),
  contactId: z
    .string()
    .transform((v) => (v.trim() === "" ? null : parseInt(v, 10))),
  dealId: z
    .string()
    .transform((v) => (v.trim() === "" ? null : parseInt(v, 10))),
  dueAt: z
    .string()
    .transform((v) => (v.trim() === "" ? null : new Date(v))),
  completedAt: z
    .string()
    .transform((v) => (v === "on" ? new Date() : null)),
});

export type AddActivityState = {
  error?: string;
  fieldErrors?: Partial<Record<"type" | "subject" | "body", string[]>>;
  success?: boolean;
  noDb?: boolean;
};

export async function addActivity(
  _prev: AddActivityState,
  formData: FormData
): Promise<AddActivityState> {
  const raw = {
    type: String(formData.get("type") ?? "note"),
    subject: String(formData.get("subject") ?? ""),
    body: String(formData.get("body") ?? ""),
    contactId: String(formData.get("contactId") ?? ""),
    dealId: String(formData.get("dealId") ?? ""),
    dueAt: String(formData.get("dueAt") ?? ""),
    completedAt: String(formData.get("completedAt") ?? ""),
  };

  const parsed = AddActivitySchema.safeParse(raw);
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten()
        .fieldErrors as AddActivityState["fieldErrors"],
    };
  }

  const db = getDb();
  if (!db) return { noDb: true };

  await db.insert(schema.activities).values({
    type: parsed.data.type,
    subject: parsed.data.subject,
    body: parsed.data.body,
    contactId: parsed.data.contactId,
    dealId: parsed.data.dealId,
    dueAt: parsed.data.dueAt,
    completedAt: parsed.data.completedAt,
  });

  revalidatePath("/activity");
  if (parsed.data.contactId) {
    revalidatePath(`/contacts/${parsed.data.contactId}`);
  }
  if (parsed.data.dealId) {
    revalidatePath(`/deals/${parsed.data.dealId}`);
  }

  return { success: true };
}

export async function logAiTaskSuggestion(
  subject: string,
  contactId: number | null,
  dealId: number | null,
): Promise<{ success?: boolean; error?: string; noDb?: boolean }> {
  if (!subject?.trim()) return { error: "Subject is required" };

  const db = getDb();
  if (!db) return { noDb: true };

  await db.insert(schema.activities).values({
    type: "task",
    subject: subject.trim(),
    contactId: contactId ?? null,
    dealId: dealId ?? null,
    dueAt: new Date(),
  });

  revalidatePath("/tasks");
  revalidatePath("/activity");
  if (contactId) revalidatePath(`/contacts/${contactId}`);
  if (dealId) revalidatePath(`/deals/${dealId}`);

  return { success: true };
}

export async function toggleActivityComplete(
  activityId: number,
  isCompleted: boolean,
  contactId: number | null,
  dealId: number | null,
): Promise<{ error?: string }> {
  const db = getDb();
  if (!db) return { error: "No database" };

  await db
    .update(schema.activities)
    .set({
      completedAt: isCompleted ? null : new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.activities.id, activityId));

  revalidatePath("/activity");
  if (contactId) revalidatePath(`/contacts/${contactId}`);
  if (dealId) revalidatePath(`/deals/${dealId}`);

  return {};
}
