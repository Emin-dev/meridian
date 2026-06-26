"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/require-session";

const AddTaskSchema = z.object({
  subject: z.string().min(1, "Subject is required"),
  dueAt: z.string().min(1, "Due date is required").transform((v) => new Date(v)),
});

const AddLinkedTaskSchema = z.object({
  subject: z.string().min(1, "Subject is required"),
  dueAt: z.string().min(1, "Due date is required").transform((v) => new Date(v)),
  contactId: z.string().transform((v) => {
    const n = Number(v);
    return v.trim() === "" || !Number.isInteger(n) || n <= 0 ? null : n;
  }),
  dealId: z.string().transform((v) => {
    const n = Number(v);
    return v.trim() === "" || !Number.isInteger(n) || n <= 0 ? null : n;
  }),
});

export type AddTaskState = {
  error?: string;
  fieldErrors?: Partial<Record<"subject" | "dueAt", string[]>>;
  success?: boolean;
  noDb?: boolean;
};

export async function addTask(
  _prev: AddTaskState,
  formData: FormData
): Promise<AddTaskState> {
  await requireSession();

  const raw = {
    subject: String(formData.get("subject") ?? ""),
    dueAt: String(formData.get("dueAt") ?? ""),
  };

  const parsed = AddTaskSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors as AddTaskState["fieldErrors"],
    };
  }

  const db = getDb();
  if (!db) return { noDb: true };

  try {
    await db.insert(schema.activities).values({
      type: "task",
      subject: parsed.data.subject,
      dueAt: parsed.data.dueAt,
    });

    revalidatePath("/tasks");
    revalidatePath("/activity");

    return { success: true };
  } catch (err) {
    console.error("addTask failed:", err);
    return { error: "Could not add task — please try again." };
  }
}

export async function addLinkedTask(
  _prev: AddTaskState,
  formData: FormData
): Promise<AddTaskState> {
  await requireSession();

  const raw = {
    subject: String(formData.get("subject") ?? ""),
    dueAt: String(formData.get("dueAt") ?? ""),
    contactId: String(formData.get("contactId") ?? ""),
    dealId: String(formData.get("dealId") ?? ""),
  };

  const parsed = AddLinkedTaskSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors as AddTaskState["fieldErrors"],
    };
  }

  const db = getDb();
  if (!db) return { noDb: true };

  try {
    await db.insert(schema.activities).values({
      type: "task",
      subject: parsed.data.subject,
      dueAt: parsed.data.dueAt,
      contactId: parsed.data.contactId,
      dealId: parsed.data.dealId,
    });

    revalidatePath("/tasks");
    revalidatePath("/activity");
    if (parsed.data.contactId) revalidatePath(`/contacts/${parsed.data.contactId}`);
    if (parsed.data.dealId) revalidatePath(`/deals/${parsed.data.dealId}`);

    return { success: true };
  } catch (err) {
    console.error("addLinkedTask failed:", err);
    return { error: "Could not add task — please try again." };
  }
}

export async function toggleTaskComplete(
  activityId: number,
  isCompleted: boolean,
  contactId: number | null,
  dealId: number | null,
): Promise<{ error?: string }> {
  await requireSession();

  if (!z.coerce.number().int().positive().safeParse(activityId).success) {
    return { error: "Invalid task id" };
  }

  const db = getDb();
  if (!db) return { error: "No database" };

  try {
    await db
      .update(schema.activities)
      .set({
        completedAt: isCompleted ? null : new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.activities.id, activityId));
  } catch (err) {
    console.error("toggleTaskComplete failed:", err);
    return { error: "Could not update task — please try again." };
  }

  revalidatePath("/tasks");
  revalidatePath("/activity");
  revalidatePath("/dashboard");
  revalidatePath("/analytics");
  if (contactId) revalidatePath(`/contacts/${contactId}`);
  if (dealId) revalidatePath(`/deals/${dealId}`);

  return {};
}
