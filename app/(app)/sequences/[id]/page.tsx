import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, asc, desc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { StepCard, AddStepForm } from "./step-card";
import { CancelEnrollmentButton } from "./cancel-enrollment-button";
import { PreviewTab, type PreviewContact } from "./preview-tab";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

const STATUS_LABELS = {
  active: { label: "Active", className: "bg-emerald-500/10 text-emerald-400" },
  paused: { label: "Paused", className: "bg-neutral-700 text-neutral-400" },
} as const;

const ENROLLMENT_STATUS_LABELS = {
  active: { label: "Active", className: "bg-emerald-500/10 text-emerald-400" },
  cancelled: {
    label: "Cancelled",
    className: "bg-neutral-700 text-neutral-400",
  },
} as const;

function computeProgress(
  enrolledAt: Date,
  steps: { position: number; delayDays: number }[]
) {
  const now = new Date();
  const sorted = [...steps].sort((a, b) => a.position - b.position);
  // cumulative delay in days for each step
  const cumulativeDelays = sorted.reduce<number[]>((acc, step) => {
    acc.push((acc.at(-1) ?? 0) + step.delayDays);
    return acc;
  }, []);

  let completedSteps = 0;
  for (const totalDelay of cumulativeDelays) {
    const dueDate = new Date(
      enrolledAt.getTime() + totalDelay * 86_400_000
    );
    if (dueDate <= now) completedSteps++;
    else break;
  }

  const totalSteps = sorted.length;
  const isComplete = completedSteps >= totalSteps;
  const nextDueDate =
    isComplete || totalSteps === 0
      ? null
      : new Date(
          enrolledAt.getTime() + cumulativeDelays[completedSteps] * 86_400_000
        );

  return {
    completedSteps,
    currentStep: isComplete ? totalSteps : completedSteps + 1, // 1-based
    nextDueDate,
    isComplete,
    totalSteps,
  };
}

export default async function SequenceDetailPage({
  params,
  searchParams,
}: Props) {
  const { id } = await params;
  const { tab = "steps" } = await searchParams;
  const isPreviewTab = tab === "preview";
  const numId = Number(id);

  if (!Number.isInteger(numId) || numId <= 0) notFound();

  const db = getDb();

  if (!db) {
    return (
      <div className="space-y-6">
        <Link
          href="/sequences"
          className="text-sm text-neutral-400 transition-colors hover:text-neutral-100"
        >
          ← Sequences
        </Link>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-6 py-16 text-center">
          <p className="text-sm text-neutral-400">Database not connected.</p>
          <p className="mt-1 text-xs text-neutral-600">
            Set{" "}
            <code className="rounded bg-neutral-800 px-1 py-0.5">
              DATABASE_URL
            </code>{" "}
            to connect your Neon database.
          </p>
        </div>
      </div>
    );
  }

  const [sequence] = await db
    .select()
    .from(schema.sequences)
    .where(eq(schema.sequences.id, numId))
    .limit(1);

  if (!sequence) notFound();

  const [steps, enrollments] = await Promise.all([
    db
      .select()
      .from(schema.sequenceSteps)
      .where(eq(schema.sequenceSteps.sequenceId, numId))
      .orderBy(asc(schema.sequenceSteps.position)),
    db
      .select({
        id: schema.contactSequenceEnrollments.id,
        contactId: schema.contactSequenceEnrollments.contactId,
        contactName: schema.contacts.name,
        contactEmail: schema.contacts.email,
        contactCompany: schema.contacts.company,
        contactOwner: schema.contacts.owner,
        enrolledAt: schema.contactSequenceEnrollments.enrolledAt,
        status: schema.contactSequenceEnrollments.status,
      })
      .from(schema.contactSequenceEnrollments)
      .innerJoin(
        schema.contacts,
        eq(schema.contactSequenceEnrollments.contactId, schema.contacts.id)
      )
      .where(eq(schema.contactSequenceEnrollments.sequenceId, numId))
      .orderBy(desc(schema.contactSequenceEnrollments.enrolledAt)),
  ]);

  // Unique contacts from enrollments for the Preview tab
  const previewContacts = enrollments.reduce<PreviewContact[]>((acc, e) => {
    if (!acc.some((c) => c.id === e.contactId)) {
      acc.push({
        id: e.contactId,
        name: e.contactName,
        email: e.contactEmail ?? null,
        company: e.contactCompany ?? null,
        owner: e.contactOwner ?? null,
      });
    }
    return acc;
  }, []);

  const statusMeta = STATUS_LABELS[sequence.status];
  const isContactsTab = tab === "contacts";

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/sequences"
        className="text-sm text-neutral-400 transition-colors hover:text-neutral-100"
      >
        ← Sequences
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-neutral-100">
            {sequence.name}
          </h2>
          <div className="mt-2 flex items-center gap-2">
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusMeta.className}`}
            >
              {statusMeta.label}
            </span>
            <span className="text-xs text-neutral-500">
              {steps.length} {steps.length === 1 ? "step" : "steps"}
            </span>
          </div>
        </div>
        <div className="text-xs text-neutral-600">
          Created{" "}
          {sequence.createdAt.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-neutral-800">
        <Link
          href={`/sequences/${numId}`}
          className={`-mb-px px-4 py-2 text-sm font-medium transition-colors ${
            !isContactsTab && !isPreviewTab
              ? "border-b-2 border-neutral-100 text-neutral-100"
              : "text-neutral-400 hover:text-neutral-100"
          }`}
        >
          Steps
        </Link>
        <Link
          href={`/sequences/${numId}?tab=contacts`}
          className={`-mb-px px-4 py-2 text-sm font-medium transition-colors ${
            isContactsTab
              ? "border-b-2 border-neutral-100 text-neutral-100"
              : "text-neutral-400 hover:text-neutral-100"
          }`}
        >
          Enrolled Contacts
          {enrollments.length > 0 && (
            <span className="ml-1.5 rounded-full bg-neutral-800 px-1.5 py-0.5 text-xs font-normal text-neutral-400">
              {enrollments.length}
            </span>
          )}
        </Link>
        <Link
          href={`/sequences/${numId}?tab=preview`}
          className={`-mb-px px-4 py-2 text-sm font-medium transition-colors ${
            isPreviewTab
              ? "border-b-2 border-neutral-100 text-neutral-100"
              : "text-neutral-400 hover:text-neutral-100"
          }`}
        >
          Preview
        </Link>
      </div>

      {/* Tab content */}
      {isPreviewTab ? (
        /* Preview */
        <PreviewTab steps={steps} contacts={previewContacts} />
      ) : !isContactsTab ? (
        /* Steps */
        <div>
          {steps.length === 0 ? (
            <div className="mb-4 rounded-xl border border-dashed border-neutral-800 bg-neutral-900/50 px-6 py-10 text-center">
              <p className="text-sm text-neutral-500">No steps yet.</p>
              <p className="mt-1 text-xs text-neutral-600">
                Add the first step to this sequence below.
              </p>
            </div>
          ) : (
            <div className="mb-4 space-y-3">
              {steps.map((step) => (
                <StepCard key={step.id} step={step} sequenceId={numId} />
              ))}
            </div>
          )}

          <AddStepForm sequenceId={numId} />
        </div>
      ) : (
        /* Enrolled Contacts */
        <div>
          {enrollments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-neutral-800 bg-neutral-900/50 px-6 py-10 text-center">
              <p className="text-sm text-neutral-500">No contacts enrolled.</p>
              <p className="mt-1 text-xs text-neutral-600">
                Enroll contacts from a contact&apos;s detail page.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-neutral-800 bg-neutral-900">
              <ul className="divide-y divide-neutral-800">
                {enrollments.map((enrollment) => {
                  const enrStatus =
                    ENROLLMENT_STATUS_LABELS[enrollment.status];
                  const progress = computeProgress(
                    enrollment.enrolledAt,
                    steps
                  );
                  const pct =
                    progress.totalSteps > 0
                      ? Math.round(
                          (progress.completedSteps / progress.totalSteps) * 100
                        )
                      : 0;
                  const isCancelled = enrollment.status === "cancelled";
                  return (
                    <li key={enrollment.id} className="px-4 py-4">
                      <div className="flex items-start justify-between gap-4">
                        {/* Left: name + email */}
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/contacts/${enrollment.contactId}`}
                            className="truncate text-sm font-medium text-neutral-100 transition-colors hover:text-neutral-300"
                          >
                            {enrollment.contactName}
                          </Link>
                          {enrollment.contactEmail && (
                            <p className="truncate text-xs text-neutral-500">
                              {enrollment.contactEmail}
                            </p>
                          )}
                        </div>
                        {/* Right: step position + status + cancel */}
                        <div className="flex shrink-0 items-center gap-3">
                          {progress.totalSteps > 0 && (
                            <div className="text-right">
                              <p className="text-xs font-medium text-neutral-300">
                                {progress.isComplete
                                  ? "Complete"
                                  : `Step ${progress.currentStep} of ${progress.totalSteps}`}
                              </p>
                              {progress.nextDueDate && !isCancelled && (
                                <p className="text-xs text-neutral-500">
                                  Due{" "}
                                  {progress.nextDueDate.toLocaleDateString(
                                    "en-US",
                                    {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                    }
                                  )}
                                </p>
                              )}
                            </div>
                          )}
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${enrStatus.className}`}
                          >
                            {enrStatus.label}
                          </span>
                          {enrollment.status === "active" && (
                            <CancelEnrollmentButton
                              enrollmentId={enrollment.id}
                              sequenceId={numId}
                            />
                          )}
                        </div>
                      </div>
                      {/* Progress bar */}
                      {progress.totalSteps > 0 && (
                        <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
                          <div
                            className={`h-full rounded-full transition-all ${
                              isCancelled
                                ? "bg-neutral-600"
                                : progress.isComplete
                                  ? "bg-emerald-500"
                                  : "bg-emerald-500/70"
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
