import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import EditNotesForm from "./edit-notes-form";
import DeleteDealButton from "./delete-deal-button";
import DealDetailTop from "./deal-detail-top";
import DealActivityTimeline from "./deal-activity-timeline";
import DealChangeLog from "./deal-change-log";
import DealSummarizePanel from "./deal-summarize-panel";
import DealWinProbabilityPanel from "./deal-win-probability-panel";
import DealNextActionPanel from "./deal-next-action-panel";
import WinLossInsightCallout from "./win-loss-insight-callout";
import { extractUserNotes, extractWinLossInsight } from "./notes-utils";
import LinkedTasksSection from "@/app/(app)/tasks/linked-tasks-section";
import ActionItemsPanel from "@/components/action-items-panel";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function DealDetailPage({ params }: Props) {
  const { id } = await params;
  const numId = Number(id);

  if (!Number.isInteger(numId) || numId <= 0) notFound();

  const db = getDb();

  if (!db) {
    return (
      <div className="space-y-6">
        <Link
          href="/deals"
          className="text-sm text-neutral-400 hover:text-neutral-100 transition-colors"
        >
          ← Deals
        </Link>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-16 text-center sm:px-5">
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

  const [deal] = await db
    .select()
    .from(schema.deals)
    .where(eq(schema.deals.id, numId))
    .limit(1);

  if (!deal) notFound();

  let contact = null;
  if (deal.contactId) {
    const [c] = await db
      .select()
      .from(schema.contacts)
      .where(eq(schema.contacts.id, deal.contactId))
      .limit(1);
    contact = c ?? null;
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/deals"
        className="text-sm text-neutral-400 hover:text-neutral-100 transition-colors"
      >
        ← Deals
      </Link>

      {/* Optimistic header + edit form (client-managed state) */}
      <DealDetailTop
        initialDeal={deal}
        deleteButton={<DeleteDealButton dealId={deal.id} />}
      />

      {/* Linked contact */}
      {contact ? (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 sm:p-5">
          <h3 className="mb-3 text-sm font-medium text-neutral-300">
            Linked contact
          </h3>
          <Link
            href={`/contacts/${contact.id}`}
            className="group flex items-center gap-3"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-700 text-sm font-medium text-neutral-300 transition-colors group-hover:bg-neutral-600">
              {contact.name[0].toUpperCase()}
            </span>
            <div>
              <p className="text-sm font-medium text-neutral-100 transition-colors group-hover:text-indigo-400">
                {contact.name}
              </p>
              {(contact.title || contact.company) && (
                <p className="text-xs text-neutral-500">
                  {[contact.title, contact.company].filter(Boolean).join(" · ")}
                </p>
              )}
              {contact.email && (
                <p className="text-xs text-neutral-600">{contact.email}</p>
              )}
            </div>
          </Link>
        </div>
      ) : deal.contactId ? (
        <div className="rounded-xl border border-dashed border-neutral-800 bg-neutral-900/50 p-4 sm:p-5">
          <p className="text-xs text-neutral-500">Contact was removed</p>
          <p className="mt-1 text-xs text-neutral-600">
            The contact linked to this deal no longer exists and may have been
            deleted.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-neutral-800 bg-neutral-900/50 p-4 sm:p-5">
          <p className="text-xs text-neutral-600">No contact linked to this deal.</p>
        </div>
      )}

      {/* AI Win/Loss Insight callout */}
      {extractWinLossInsight(deal.notes) && (
        <WinLossInsightCallout
          insight={extractWinLossInsight(deal.notes)!}
          stage={deal.stage as "won" | "lost"}
          dealId={deal.id}
        />
      )}

      {/* Notes */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 sm:p-5">
        <h3 className="mb-4 text-sm font-medium text-neutral-300">Notes</h3>
        <EditNotesForm dealId={deal.id} initialNotes={extractUserNotes(deal.notes)} />
      </div>

      {/* AI win-probability score */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 sm:p-5">
        <DealWinProbabilityPanel dealId={deal.id} initialScore={deal.probability} />
      </div>

      {/* AI deal brief */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 sm:p-5">
        <DealSummarizePanel dealId={deal.id} />
      </div>

      {/* AI next best action */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 sm:p-5">
        <DealNextActionPanel dealId={deal.id} />
      </div>

      {/* AI action items extractor */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 sm:p-5">
        <ActionItemsPanel dealId={deal.id} />
      </div>

      {/* Linked tasks */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 sm:p-5">
        <LinkedTasksSection dealId={deal.id} />
      </div>

      {/* Activity timeline */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 sm:p-5">
        <DealActivityTimeline dealId={deal.id} />
      </div>

      {/* Change log */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 sm:p-5">
        <DealChangeLog dealId={deal.id} />
      </div>
    </div>
  );
}
