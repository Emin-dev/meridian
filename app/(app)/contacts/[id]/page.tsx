import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import EditContactForm from "./edit-contact-form";
import DraftEmailPanel from "./draft-email-panel";
import SummarizePanel from "./summarize-panel";
import LeadScorePanel from "./lead-score-panel";

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

      {/* AI email draft card */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-6 py-5">
        <DraftEmailPanel contactId={contact.id} />
      </div>
    </div>
  );
}
