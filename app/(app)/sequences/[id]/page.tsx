import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, asc, desc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { StepCard, AddStepForm } from "./step-card";
import { CancelEnrollmentButton } from "./cancel-enrollment-button";
import { PreviewTab, type PreviewContact } from "./preview-tab";
import { SendStepButton } from "./send-step-button";
import {
  EnrollmentCardsMobile,
  type EnrollmentRow,
} from "./enrollment-cards-mobile";
import { getCrmSettings } from "@/lib/settings";
import { SequenceStatusToggle } from "../sequence-status-toggle";
import { SequenceTitle } from "./sequence-title";
import DeleteSequenceButton from "./delete-sequence-button";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

const STATUS_LABELS = {
  active: { label: "Active", className: "bg-[var(--ok-tint)] text-[var(--ok)]" },
  paused: { label: "Paused", className: "bg-[var(--surface-2)] text-[var(--ink-2)]" },
} as const;

const ENROLLMENT_STATUS_LABELS = {
  active: { label: "Active", className: "bg-[var(--ok-tint)] text-[var(--ok)]" },
  cancelled: {
    label: "Cancelled",
    className: "bg-[var(--surface-2)] text-[var(--ink-2)]",
  },
  completed: {
    label: "Completed",
    className: "bg-[var(--info-tint)] text-[var(--info)]",
  },
} as const;

function computeProgress(
  enrolledAt: Date,
  steps: { position: number; delayDays: number }[],
  currentStepPosition: number,
) {
  const sorted = [...steps].sort((a, b) => a.position - b.position);
  const totalSteps = sorted.length;

  const cumulativeDelays = sorted.reduce<number[]>((acc, step) => {
    acc.push((acc.at(-1) ?? 0) + step.delayDays);
    return acc;
  }, []);

  const isComplete = currentStepPosition >= totalSteps;

  const currentStepDueDate =
    isComplete || totalSteps === 0 || currentStepPosition >= cumulativeDelays.length
      ? null
      : new Date(enrolledAt.getTime() + cumulativeDelays[currentStepPosition] * 86_400_000);

  const isDue = currentStepDueDate !== null && currentStepDueDate <= new Date();

  return {
    sentSteps: currentStepPosition,
    currentStep: isComplete ? totalSteps : currentStepPosition + 1, // 1-based
    currentStepDueDate,
    isDue,
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
          className="text-sm text-[var(--ink-2)] transition-colors hover:text-[var(--ink-1)]"
        >
          ← Sequences
        </Link>
        <div className="rounded-xl border border-[var(--line-1)] bg-[var(--surface-1)] px-6 py-16 text-center">
          <p className="text-sm text-[var(--ink-2)]">Database not connected.</p>
          <p className="mt-1 text-xs text-[var(--ink-3)]">
            Set{" "}
            <code className="rounded bg-[var(--surface-2)] px-1 py-0.5">
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

  const [steps, enrollments, crmSettings] = await Promise.all([
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
        currentStepPosition: schema.contactSequenceEnrollments.currentStepPosition,
      })
      .from(schema.contactSequenceEnrollments)
      .innerJoin(
        schema.contacts,
        eq(schema.contactSequenceEnrollments.contactId, schema.contacts.id)
      )
      .where(eq(schema.contactSequenceEnrollments.sequenceId, numId))
      .orderBy(desc(schema.contactSequenceEnrollments.enrolledAt)),
    getCrmSettings(),
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

  // Precompute one row per enrollment so the dense desktop list and the
  // glanceable mobile cards stay in lockstep (no divergent progress math).
  const enrollmentRows: EnrollmentRow[] = enrollments.map((enrollment) => {
    const enrStatus = ENROLLMENT_STATUS_LABELS[enrollment.status];
    const progress = computeProgress(
      enrollment.enrolledAt,
      steps,
      enrollment.currentStepPosition,
    );
    const pct =
      progress.totalSteps > 0
        ? Math.round((progress.sentSteps / progress.totalSteps) * 100)
        : 0;
    const isCancelled = enrollment.status === "cancelled";
    const isCompleted = enrollment.status === "completed";
    const currentStep = steps[enrollment.currentStepPosition];
    const showSendButton =
      enrollment.status === "active" &&
      !progress.isComplete &&
      progress.isDue &&
      currentStep !== undefined;
    const progressLabel =
      progress.totalSteps > 0
        ? progress.isComplete
          ? "Complete"
          : `Step ${progress.currentStep} of ${progress.totalSteps}`
        : null;
    const dueLabel =
      progress.currentStepDueDate && !isCancelled && !isCompleted
        ? progress.isDue
          ? "Due now"
          : `Due ${progress.currentStepDueDate.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}`
        : null;
    return {
      id: enrollment.id,
      contactId: enrollment.contactId,
      contactName: enrollment.contactName,
      contactEmail: enrollment.contactEmail ?? null,
      status: enrollment.status,
      statusLabel: enrStatus.label,
      statusClassName: enrStatus.className,
      progressLabel,
      dueLabel,
      pct,
      totalSteps: progress.totalSteps,
      isActive: enrollment.status === "active",
      isCancelled,
      isCompleted,
      isComplete: progress.isComplete,
      sendStep:
        showSendButton && currentStep
          ? {
              contactCompany: enrollment.contactCompany ?? null,
              contactOwner: enrollment.contactOwner ?? null,
              stepSubjectTemplate: currentStep.subjectTemplate,
              stepBodyTemplate: currentStep.bodyTemplate,
              stepPosition: enrollment.currentStepPosition + 1,
              newStepPosition: enrollment.currentStepPosition + 1,
            }
          : null,
    };
  });

  const statusMeta = STATUS_LABELS[sequence.status];
  const isContactsTab = tab === "contacts";

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/sequences"
        className="text-sm text-[var(--ink-2)] transition-colors hover:text-[var(--ink-1)]"
      >
        ← Sequences
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <SequenceTitle id={numId} name={sequence.name} />
          <div className="mt-2 flex items-center gap-2">
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusMeta.className}`}
            >
              {statusMeta.label}
            </span>
            <SequenceStatusToggle id={numId} status={sequence.status} />
            <span className="text-xs text-[var(--ink-3)]">
              {steps.length} {steps.length === 1 ? "step" : "steps"}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-3">
          <div className="text-xs text-[var(--ink-3)]">
            Created{" "}
            {sequence.createdAt.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </div>
          <DeleteSequenceButton sequenceId={numId} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-[var(--line-1)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Link
          href={`/sequences/${numId}`}
          className={`-mb-px inline-flex min-h-[44px] shrink-0 items-center whitespace-nowrap px-4 py-2 text-sm font-medium transition-colors ${
            !isContactsTab && !isPreviewTab
              ? "border-b-2 border-[var(--accent)] text-[var(--ink-1)]"
              : "text-[var(--ink-2)] hover:text-[var(--ink-1)]"
          }`}
        >
          Steps
        </Link>
        <Link
          href={`/sequences/${numId}?tab=contacts`}
          className={`-mb-px inline-flex min-h-[44px] shrink-0 items-center whitespace-nowrap px-4 py-2 text-sm font-medium transition-colors ${
            isContactsTab
              ? "border-b-2 border-[var(--accent)] text-[var(--ink-1)]"
              : "text-[var(--ink-2)] hover:text-[var(--ink-1)]"
          }`}
        >
          Enrolled Contacts
          {enrollments.length > 0 && (
            <span className="ml-1.5 rounded-full bg-[var(--surface-2)] px-1.5 py-0.5 text-xs font-normal text-[var(--ink-2)]">
              {enrollments.length}
            </span>
          )}
        </Link>
        <Link
          href={`/sequences/${numId}?tab=preview`}
          className={`-mb-px inline-flex min-h-[44px] shrink-0 items-center whitespace-nowrap px-4 py-2 text-sm font-medium transition-colors ${
            isPreviewTab
              ? "border-b-2 border-[var(--accent)] text-[var(--ink-1)]"
              : "text-[var(--ink-2)] hover:text-[var(--ink-1)]"
          }`}
        >
          Preview
        </Link>
      </div>

      {/* Tab content */}
      {isPreviewTab ? (
        /* Preview */
        <PreviewTab steps={steps} contacts={previewContacts} defaultOwnerName={crmSettings.displayName} />
      ) : !isContactsTab ? (
        /* Steps */
        <div>
          {steps.length === 0 ? (
            <div className="mb-4 rounded-xl border border-dashed border-[var(--line-1)] bg-[var(--surface-1)]/50 px-6 py-10 text-center">
              <p className="text-sm text-[var(--ink-3)]">No steps yet.</p>
              <p className="mt-1 text-xs text-[var(--ink-3)]">
                Add the first step to this sequence below.
              </p>
            </div>
          ) : (
            <div className="mb-4 space-y-3">
              {steps.map((step, idx) => (
                <StepCard
                  key={step.id}
                  step={step}
                  sequenceId={numId}
                  isFirst={idx === 0}
                  isLast={idx === steps.length - 1}
                />
              ))}
            </div>
          )}

          <AddStepForm
            sequenceId={numId}
            sequenceName={sequence.name}
            nextPosition={steps.length + 1}
            hasAiKey={!!process.env.DEEPSEEK_API_KEY}
          />
        </div>
      ) : (
        /* Enrolled Contacts */
        <div>
          {enrollments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--line-1)] bg-[var(--surface-1)]/50 px-6 py-10 text-center">
              <p className="text-sm text-[var(--ink-3)]">No contacts enrolled.</p>
              <p className="mt-1 text-xs text-[var(--ink-3)]">
                Enroll contacts from a contact&apos;s detail page.
              </p>
            </div>
          ) : (
            <>
              {/* Mobile (<lg): glanceable tap-to-expand cards */}
              <div className="lg:hidden">
                <EnrollmentCardsMobile
                  rows={enrollmentRows}
                  sequenceId={numId}
                  defaultOwnerName={crmSettings.displayName}
                />
              </div>

              {/* Desktop (lg+): dense list */}
              <div className="hidden rounded-xl border border-[var(--line-1)] bg-[var(--surface-1)] lg:block">
                <ul className="divide-y divide-[var(--line-1)]">
                  {enrollmentRows.map((row) => (
                    <li key={row.id} className="px-4 py-4">
                      {/* Row 1: name + status badge */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/contacts/${row.contactId}`}
                            className="block truncate text-body font-medium text-[var(--ink-1)] transition-colors hover:text-[var(--ink-2)]"
                          >
                            {row.contactName}
                          </Link>
                          {row.contactEmail && (
                            <p className="truncate text-footnote text-[var(--ink-3)]">
                              {row.contactEmail}
                            </p>
                          )}
                        </div>
                        <span
                          className={`shrink-0 inline-block rounded-full px-2 py-0.5 text-caption font-medium ${row.statusClassName}`}
                        >
                          {row.statusLabel}
                        </span>
                      </div>
                      {/* Row 2: step progress + action buttons */}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {row.progressLabel && (
                          <span className="text-footnote text-[var(--ink-3)]">
                            {row.progressLabel}
                            {row.dueLabel ? ` · ${row.dueLabel}` : ""}
                          </span>
                        )}
                        {row.sendStep && (
                          <SendStepButton
                            enrollmentId={row.id}
                            sequenceId={numId}
                            contactId={row.contactId}
                            contactName={row.contactName}
                            contactEmail={row.contactEmail}
                            contactCompany={row.sendStep.contactCompany}
                            contactOwner={row.sendStep.contactOwner}
                            stepSubjectTemplate={row.sendStep.stepSubjectTemplate}
                            stepBodyTemplate={row.sendStep.stepBodyTemplate}
                            stepPosition={row.sendStep.stepPosition}
                            newStepPosition={row.sendStep.newStepPosition}
                            totalSteps={row.totalSteps}
                            defaultOwnerName={crmSettings.displayName}
                          />
                        )}
                        {row.isActive && (
                          <CancelEnrollmentButton
                            enrollmentId={row.id}
                            sequenceId={numId}
                          />
                        )}
                      </div>
                      {/* Progress bar */}
                      {row.totalSteps > 0 && (
                        <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
                          <div
                            className={`h-full rounded-full transition-all ${
                              row.isCancelled
                                ? "bg-[var(--ink-3)]"
                                : row.isCompleted || row.isComplete
                                  ? "bg-[var(--ok)]"
                                  : "bg-[var(--ok)]/70"
                            }`}
                            style={{ width: `${row.pct}%` }}
                          />
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
