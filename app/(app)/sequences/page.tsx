import Link from "next/link";
import { and, asc, count, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Sequence } from "@/db/schema";
import { getCrmSettings } from "@/lib/settings";
import { SequenceStatusToggle } from "./sequence-status-toggle";
import { DueStepsSection, type DueEnrollment } from "./due-steps-section";

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-[--ok-tint] text-[--ok]" },
  paused: { label: "Paused", className: "bg-[--surface-2] text-[--ink-3]" },
};

export default async function SequencesPage() {
  const db = getDb();
  const crmSettings = await getCrmSettings();

  let sequences: Sequence[] = [];
  let stepCounts: Map<number, number> = new Map();
  let dueEnrollments: DueEnrollment[] = [];

  if (db) {
    const [seqResults, stepCountRows, activeSteps, activeEnrollments] =
      await Promise.all([
      db
        .select()
        .from(schema.sequences)
        .orderBy(desc(schema.sequences.createdAt)),
      // Grouped count per sequence for the list display — avoids loading every step row.
      db
        .select({
          sequenceId: schema.sequenceSteps.sequenceId,
          count: count(),
        })
        .from(schema.sequenceSteps)
        .groupBy(schema.sequenceSteps.sequenceId),
      // Step rows are only needed to compute due steps, which apply solely to
      // active sequences — so scope the row load to those.
      db
        .select({
          sequenceId: schema.sequenceSteps.sequenceId,
          position: schema.sequenceSteps.position,
          delayDays: schema.sequenceSteps.delayDays,
          subjectTemplate: schema.sequenceSteps.subjectTemplate,
          bodyTemplate: schema.sequenceSteps.bodyTemplate,
        })
        .from(schema.sequenceSteps)
        .innerJoin(
          schema.sequences,
          eq(schema.sequenceSteps.sequenceId, schema.sequences.id),
        )
        .where(eq(schema.sequences.status, "active"))
        .orderBy(asc(schema.sequenceSteps.position)),
      db
        .select({
          id: schema.contactSequenceEnrollments.id,
          contactId: schema.contactSequenceEnrollments.contactId,
          sequenceId: schema.contactSequenceEnrollments.sequenceId,
          enrolledAt: schema.contactSequenceEnrollments.enrolledAt,
          currentStepPosition:
            schema.contactSequenceEnrollments.currentStepPosition,
          contactName: schema.contacts.name,
          contactEmail: schema.contacts.email,
          contactCompany: schema.contacts.company,
          contactOwner: schema.contacts.owner,
          sequenceName: schema.sequences.name,
        })
        .from(schema.contactSequenceEnrollments)
        .innerJoin(
          schema.contacts,
          eq(
            schema.contactSequenceEnrollments.contactId,
            schema.contacts.id,
          ),
        )
        .innerJoin(
          schema.sequences,
          eq(
            schema.contactSequenceEnrollments.sequenceId,
            schema.sequences.id,
          ),
        )
        .where(
          and(
            eq(schema.contactSequenceEnrollments.status, "active"),
            eq(schema.sequences.status, "active"),
          ),
        ),
    ]);

    sequences = seqResults;

    for (const row of stepCountRows) {
      stepCounts.set(row.sequenceId, row.count);
    }

    const stepsBySequence = new Map<number, typeof activeSteps>();
    for (const step of activeSteps) {
      const arr = stepsBySequence.get(step.sequenceId) ?? [];
      arr.push(step);
      stepsBySequence.set(step.sequenceId, arr);
    }

    const now = new Date();

    for (const enrollment of activeEnrollments) {
      const steps = stepsBySequence.get(enrollment.sequenceId) ?? [];
      if (steps.length === 0) continue;

      const totalSteps = steps.length;
      if (enrollment.currentStepPosition >= totalSteps) continue;

      let cumulative = 0;
      for (let i = 0; i <= enrollment.currentStepPosition; i++) {
        cumulative += steps[i].delayDays;
      }

      const dueDate = new Date(
        enrollment.enrolledAt.getTime() + cumulative * 86_400_000,
      );
      if (dueDate > now) continue;

      const daysOverdue = Math.floor(
        (now.getTime() - dueDate.getTime()) / 86_400_000,
      );
      const currentStep = steps[enrollment.currentStepPosition];

      dueEnrollments.push({
        enrollmentId: enrollment.id,
        sequenceId: enrollment.sequenceId,
        sequenceName: enrollment.sequenceName,
        contactId: enrollment.contactId,
        contactName: enrollment.contactName,
        contactEmail: enrollment.contactEmail ?? null,
        contactCompany: enrollment.contactCompany ?? null,
        contactOwner: enrollment.contactOwner ?? null,
        stepSubjectTemplate: currentStep.subjectTemplate,
        stepBodyTemplate: currentStep.bodyTemplate,
        stepPosition: enrollment.currentStepPosition + 1,
        newStepPosition: enrollment.currentStepPosition + 1,
        totalSteps,
        daysOverdue,
      });
    }

    dueEnrollments.sort((a, b) => b.daysOverdue - a.daysOverdue);
  }

  return (
    <div className="space-y-6">
      {/* Responsive page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-title2 font-semibold text-[--ink-1]">Sequences</h2>
          <p className="mt-1 text-body text-[--ink-2]">
            Automated email sequences for outreach campaigns.
          </p>
        </div>
        <Link
          href="/sequences/new"
          className="tap press flex items-center justify-center self-start rounded-[--r-md] bg-[--accent] px-4 text-body font-medium text-[--accent-ink] hover:bg-[--accent-hover] sm:self-auto"
        >
          New sequence
        </Link>
      </div>

      {/* Due Steps — only rendered when there are overdue enrollments */}
      <DueStepsSection
        dueEnrollments={dueEnrollments}
        defaultOwnerName={crmSettings.displayName}
      />

      <div className="card overflow-hidden">
        <div className="border-b border-[--line-1] px-4 py-3">
          <p className="text-caption font-medium uppercase tracking-wide text-[--ink-3]">
            All Sequences
          </p>
        </div>

        {sequences.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-5 py-16 text-center">
            <p className="text-body text-[--ink-2]">
              {db ? "No sequences yet." : "Database not connected."}
            </p>
            <p className="text-footnote text-[--ink-3]">
              {db
                ? 'Click "New sequence" to create your first email sequence.'
                : "Set DATABASE_URL to connect your Neon database."}
            </p>
            {db && (
              <Link
                href="/sequences/new"
                className="tap press mt-1 flex items-center justify-center rounded-[--r-md] bg-[--accent] px-4 text-body font-medium text-[--accent-ink] hover:bg-[--accent-hover]"
              >
                New sequence
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* Mobile: card list */}
            <ul className="divide-y divide-[--line-1] sm:hidden">
              {sequences.map((seq) => {
                const statusMeta = STATUS_LABELS[seq.status];
                const count = stepCounts.get(seq.id) ?? 0;
                return (
                  <li key={seq.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/sequences/${seq.id}`}
                          className="block truncate text-body font-medium text-[--ink-1] transition-colors hover:text-[--accent]"
                        >
                          {seq.name}
                        </Link>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-caption font-medium ${statusMeta.className}`}
                          >
                            {statusMeta.label}
                          </span>
                          <span className="text-footnote text-[--ink-3]">
                            {count} {count === 1 ? "step" : "steps"}
                          </span>
                          <span className="text-footnote text-[--ink-3]">
                            {seq.createdAt.toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                      </div>
                      <SequenceStatusToggle id={seq.id} status={seq.status} />
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Desktop: table */}
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[--line-1] text-left">
                    <th className="px-5 py-3 text-caption font-medium uppercase tracking-wide text-[--ink-3]">
                      Name
                    </th>
                    <th className="px-5 py-3 text-caption font-medium uppercase tracking-wide text-[--ink-3]">
                      Status
                    </th>
                    <th className="px-5 py-3 text-caption font-medium uppercase tracking-wide text-[--ink-3]">
                      Steps
                    </th>
                    <th className="px-5 py-3 text-caption font-medium uppercase tracking-wide text-[--ink-3]">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sequences.map((seq) => {
                    const statusMeta = STATUS_LABELS[seq.status];
                    const count = stepCounts.get(seq.id) ?? 0;
                    return (
                      <tr
                        key={seq.id}
                        className="border-b border-[--line-1] last:border-0 transition-colors hover:bg-[--surface-2]/40"
                      >
                        <td className="px-5 py-3 font-medium text-[--ink-1]">
                          <Link
                            href={`/sequences/${seq.id}`}
                            className="transition-colors hover:text-[--accent]"
                          >
                            {seq.name}
                          </Link>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusMeta.className}`}
                            >
                              {statusMeta.label}
                            </span>
                            <SequenceStatusToggle id={seq.id} status={seq.status} />
                          </div>
                        </td>
                        <td className="px-5 py-3 text-[--ink-2]">
                          {count} {count === 1 ? "step" : "steps"}
                        </td>
                        <td className="px-5 py-3 text-[--ink-2]">
                          {seq.createdAt.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
