"use server";

import { and, asc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema } from "@/db";
import { interpolate, contactToVars } from "@/lib/template";
import { getCrmSettings } from "@/lib/settings";

export async function sendAllDueSteps(
  enrollmentIds: number[],
): Promise<{ error?: string; sent: number }> {
  if (enrollmentIds.length === 0) return { sent: 0 };

  const db = getDb();
  if (!db) return { error: "No database", sent: 0 };

  const crmSettings = await getCrmSettings();
  const ownerFallback = crmSettings.displayName || "[Owner Name]";

  const enrollments = await db
    .select({
      id: schema.contactSequenceEnrollments.id,
      contactId: schema.contactSequenceEnrollments.contactId,
      sequenceId: schema.contactSequenceEnrollments.sequenceId,
      currentStepPosition: schema.contactSequenceEnrollments.currentStepPosition,
      contactName: schema.contacts.name,
      contactEmail: schema.contacts.email,
      contactCompany: schema.contacts.company,
      contactOwner: schema.contacts.owner,
    })
    .from(schema.contactSequenceEnrollments)
    .innerJoin(
      schema.contacts,
      eq(schema.contactSequenceEnrollments.contactId, schema.contacts.id),
    )
    .innerJoin(
      schema.sequences,
      eq(schema.contactSequenceEnrollments.sequenceId, schema.sequences.id),
    )
    .where(
      and(
        inArray(schema.contactSequenceEnrollments.id, enrollmentIds),
        eq(schema.contactSequenceEnrollments.status, "active"),
        eq(schema.sequences.status, "active"),
      ),
    );

  if (enrollments.length === 0) return { sent: 0 };

  const sequenceIds = [...new Set(enrollments.map((e) => e.sequenceId))];

  const allSteps = await db
    .select()
    .from(schema.sequenceSteps)
    .where(inArray(schema.sequenceSteps.sequenceId, sequenceIds))
    .orderBy(asc(schema.sequenceSteps.position));

  const stepsBySequence = new Map<number, typeof allSteps>();
  for (const step of allSteps) {
    const arr = stepsBySequence.get(step.sequenceId) ?? [];
    arr.push(step);
    stepsBySequence.set(step.sequenceId, arr);
  }

  let sent = 0;
  const affectedContactIds = new Set<number>();
  const affectedSequenceIds = new Set<number>();

  for (const enrollment of enrollments) {
    const steps = (stepsBySequence.get(enrollment.sequenceId) ?? []).sort(
      (a, b) => a.position - b.position,
    );
    const totalSteps = steps.length;
    if (enrollment.currentStepPosition >= totalSteps) continue;

    const currentStep = steps[enrollment.currentStepPosition];
    const vars = {
      ...contactToVars({
        name: enrollment.contactName,
        company: enrollment.contactCompany,
        owner: enrollment.contactOwner,
      }),
      ownerName: enrollment.contactOwner ?? ownerFallback,
    };
    const subject = interpolate(currentStep.subjectTemplate, vars);
    const body = interpolate(currentStep.bodyTemplate, vars);
    const newStepPosition = enrollment.currentStepPosition + 1;
    const isCompleted = newStepPosition >= totalSteps;

    await db.insert(schema.activities).values({
      type: "email",
      subject,
      body,
      contactId: enrollment.contactId,
      completedAt: new Date(),
    });

    await db
      .update(schema.contactSequenceEnrollments)
      .set({
        currentStepPosition: newStepPosition,
        ...(isCompleted ? { status: "completed" as const } : {}),
      })
      .where(eq(schema.contactSequenceEnrollments.id, enrollment.id));

    affectedContactIds.add(enrollment.contactId);
    affectedSequenceIds.add(enrollment.sequenceId);
    sent++;
  }

  for (const contactId of affectedContactIds) {
    revalidatePath(`/contacts/${contactId}`);
  }
  for (const sequenceId of affectedSequenceIds) {
    revalidatePath(`/sequences/${sequenceId}`);
  }
  revalidatePath("/sequences");

  return { sent };
}
