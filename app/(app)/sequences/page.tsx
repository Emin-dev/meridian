import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Sequence } from "@/db/schema";
import { getCrmSettings } from "@/lib/settings";
import { SequenceStatusToggle } from "./sequence-status-toggle";
import { DueStepsSection, type DueEnrollment } from "./due-steps-section";

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-emerald-500/10 text-emerald-400" },
  paused: { label: "Paused", className: "bg-neutral-700 text-neutral-400" },
};

export default async function SequencesPage() {
  const db = getDb();
  const crmSettings = await getCrmSettings();

  let sequences: Sequence[] = [];
  let stepCounts: Map<number, number> = new Map();
  let dueEnrollments: DueEnrollment[] = [];

  if (db) {
    const [seqResults, allSteps, activeEnrollments] = await Promise.all([
      db
        .select()
        .from(schema.sequences)
        .orderBy(desc(schema.sequences.createdAt)),
      db
        .select()
        .from(schema.sequenceSteps)
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
        .where(eq(schema.contactSequenceEnrollments.status, "active")),
    ]);

    sequences = seqResults;

    // Build step counts and a per-sequence steps map from a single query result
    const stepsBySequence = new Map<number, typeof allSteps>();
    for (const step of allSteps) {
      stepCounts.set(step.sequenceId, (stepCounts.get(step.sequenceId) ?? 0) + 1);
      const arr = stepsBySequence.get(step.sequenceId) ?? [];
      arr.push(step);
      stepsBySequence.set(step.sequenceId, arr);
    }

    // Compute which active enrollments have a step that is currently due
    const now = new Date();

    for (const enrollment of activeEnrollments) {
      const steps = stepsBySequence.get(enrollment.sequenceId) ?? [];
      if (steps.length === 0) continue;

      // Steps are already ordered by position (asc) from the query
      const totalSteps = steps.length;
      if (enrollment.currentStepPosition >= totalSteps) continue;

      // Cumulative delay up to (and including) the current step position
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

    // Most overdue first
    dueEnrollments.sort((a, b) => b.daysOverdue - a.daysOverdue);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-neutral-100">Sequences</h2>
          <p className="mt-1 text-sm text-neutral-400">
            Automated email sequences for outreach campaigns.
          </p>
        </div>
        <Link
          href="/sequences/new"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
        >
          New sequence
        </Link>
      </div>

      {/* Due Steps — only rendered when there are overdue enrollments */}
      <DueStepsSection
        dueEnrollments={dueEnrollments}
        defaultOwnerName={crmSettings.displayName}
      />

      <div className="rounded-xl border border-neutral-800 bg-neutral-900">
        <div className="border-b border-neutral-800 px-5 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            All Sequences
          </p>
        </div>

        {sequences.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-5 py-16 text-center">
            <p className="text-sm text-neutral-400">
              {db ? "No sequences yet." : "Database not connected."}
            </p>
            <p className="text-xs text-neutral-600">
              {db
                ? 'Click "New sequence" to create your first email sequence.'
                : "Set DATABASE_URL to connect your Neon database."}
            </p>
            {db && (
              <Link
                href="/sequences/new"
                className="mt-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
              >
                New sequence
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-800 text-left">
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Name
                  </th>
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Status
                  </th>
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Steps
                  </th>
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
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
                      className="border-b border-neutral-800 last:border-0 transition-colors hover:bg-neutral-800/40"
                    >
                      <td className="px-5 py-3 font-medium text-neutral-100">
                        <Link
                          href={`/sequences/${seq.id}`}
                          className="transition-colors hover:text-indigo-400"
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
                      <td className="px-5 py-3 text-neutral-400">
                        {count} {count === 1 ? "step" : "steps"}
                      </td>
                      <td className="px-5 py-3 text-neutral-400">
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
        )}
      </div>
    </div>
  );
}
