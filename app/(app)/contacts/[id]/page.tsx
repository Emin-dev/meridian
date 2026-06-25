import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { tagColor } from "../tag-color";
import EditContactForm from "./edit-contact-form";
import DraftEmailPanel from "./draft-email-panel";
import SummarizePanel from "./summarize-panel";
import LeadScorePanel from "./lead-score-panel";
import ActivityTimeline from "./activity-timeline";
import NextActionPanel from "./next-action-panel";
import EnrollSequenceModal, {
  CancelEnrollmentButton,
} from "./enroll-sequence-modal";
import EnrichContactPanel from "./enrich-contact-panel";
import LinkedTasksSection from "@/app/(app)/tasks/linked-tasks-section";
import LinkedDealsSection from "./linked-deals-section";
import ContactNotesSection from "./contact-notes-section";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ContactDetailPage({ params }: Props) {
  const { id } = await params;
  const numId = Number(id);

  if (!Number.isInteger(numId) || numId <= 0) notFound();

  const db = getDb();

  if (!db) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/contacts"
            className="text-sm text-neutral-400 hover:text-neutral-100 transition-colors"
          >
            ← Contacts
          </Link>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-6 py-16 text-center">
          <p className="text-sm text-neutral-400">Database not connected.</p>
          <p className="mt-1 text-xs text-neutral-600">
            Set <code className="rounded bg-neutral-800 px-1 py-0.5">DATABASE_URL</code> to connect
            your Neon database.
          </p>
        </div>
      </div>
    );
  }

  const [contact] = await db
    .select()
    .from(schema.contacts)
    .where(eq(schema.contacts.id, numId))
    .limit(1);

  if (!contact) notFound();

  const [activeSequences, enrollments] = await Promise.all([
    db
      .select({ id: schema.sequences.id, name: schema.sequences.name })
      .from(schema.sequences)
      .where(eq(schema.sequences.status, "active"))
      .orderBy(asc(schema.sequences.name)),
    db
      .select({
        id: schema.contactSequenceEnrollments.id,
        sequenceId: schema.contactSequenceEnrollments.sequenceId,
        sequenceName: schema.sequences.name,
        enrolledAt: schema.contactSequenceEnrollments.enrolledAt,
        status: schema.contactSequenceEnrollments.status,
      })
      .from(schema.contactSequenceEnrollments)
      .innerJoin(
        schema.sequences,
        eq(schema.contactSequenceEnrollments.sequenceId, schema.sequences.id)
      )
      .where(eq(schema.contactSequenceEnrollments.contactId, numId))
      .orderBy(desc(schema.contactSequenceEnrollments.enrolledAt)),
  ]);

  const activeEnrollmentIds = enrollments
    .filter((e) => e.status === "active")
    .map((e) => e.sequenceId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/contacts"
          className="text-sm text-neutral-400 hover:text-neutral-100 transition-colors"
        >
          ← Contacts
        </Link>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-neutral-100">{contact.name}</h2>
        {(contact.title || contact.company) && (
          <p className="mt-1 text-sm text-neutral-400">
            {[contact.title, contact.company].filter(Boolean).join(" · ")}
          </p>
        )}
        {(contact.tags ?? []).length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(contact.tags ?? []).map((t) => (
              <span
                key={t}
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${tagColor(t)}`}
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Edit card */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-6 py-5">
        <h3 className="mb-4 text-sm font-medium text-neutral-300">Contact details</h3>
        <EditContactForm contact={contact} />
      </div>

      {/* AI lead score */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-6 py-5">
        <LeadScorePanel
          contactId={contact.id}
          initialScore={contact.leadScore}
          initialRationale={contact.leadScoreRationale}
        />
      </div>

      {/* AI contact brief */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-6 py-5">
        <SummarizePanel contactId={contact.id} />
      </div>

      {/* AI contact enrichment */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-6 py-5">
        <EnrichContactPanel contactId={contact.id} />
      </div>

      {/* AI next best action */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-6 py-5">
        <NextActionPanel contactId={contact.id} />
      </div>

      {/* AI email draft card */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-6 py-5">
        <DraftEmailPanel contactId={contact.id} />
      </div>

      {/* Sequence enrollments */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-6 py-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-sm font-medium text-neutral-300">Sequences</h3>
          <EnrollSequenceModal
            contactId={contact.id}
            sequences={activeSequences}
            activeEnrollmentIds={activeEnrollmentIds}
          />
        </div>
        {enrollments.length === 0 ? (
          <p className="text-sm text-neutral-500">Not enrolled in any sequences.</p>
        ) : (
          <ul className="space-y-2">
            {enrollments.map((enrollment) => (
              <li
                key={enrollment.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-800/50 px-4 py-3"
              >
                <div>
                  <p className="text-sm text-neutral-200">
                    {enrollment.sequenceName}
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    Enrolled{" "}
                    {enrollment.enrolledAt.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      enrollment.status === "active"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-neutral-700 text-neutral-400"
                    }`}
                  >
                    {enrollment.status === "active" ? "Active" : "Cancelled"}
                  </span>
                  {enrollment.status === "active" && (
                    <CancelEnrollmentButton
                      enrollmentId={enrollment.id}
                      contactId={contact.id}
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Notes */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-6 py-5">
        <h3 className="mb-4 text-sm font-medium text-neutral-300">Notes</h3>
        <ContactNotesSection
          contactId={contact.id}
          initialNotes={contact.notes}
        />
      </div>

      {/* Linked deals */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-6 py-5">
        <LinkedDealsSection contactId={contact.id} />
      </div>

      {/* Linked tasks */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-6 py-5">
        <LinkedTasksSection contactId={contact.id} />
      </div>

      {/* Activity timeline */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-6 py-5">
        <ActivityTimeline contactId={contact.id} />
      </div>
    </div>
  );
}
