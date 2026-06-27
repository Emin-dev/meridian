import type { Metadata } from "next";
import { Suspense } from "react";
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
import DealRiskPanel from "./deal-risk-panel";
import WinLossInsightCallout from "./win-loss-insight-callout";
import { extractUserNotes, extractWinLossInsight } from "./notes-utils";
import LinkedTasksSection from "@/app/(app)/tasks/linked-tasks-section";
import ActionItemsPanel from "@/components/action-items-panel";
import DealAiAccordion from "./deal-ai-accordion";

interface Props {
  params: Promise<{ id: string }>;
}

// Small fallback for an independently-streamed async section so a slow or
// throwing query (linked tasks, activity timeline, change log) can't blank
// the whole page.
function SectionFallback() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-4 w-28 rounded-[var(--r-md)] bg-[var(--surface-2)]" />
      <div className="h-12 w-full rounded-[var(--r-md)] bg-[var(--surface-2)]" />
    </div>
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const numId = Number(id);
  const db = getDb();
  if (!db || !Number.isInteger(numId) || numId <= 0) return { title: "Deal" };
  const rows = await db
    .select({ title: schema.deals.title })
    .from(schema.deals)
    .where(eq(schema.deals.id, numId))
    .limit(1);
  return { title: rows[0]?.title ?? "Deal" };
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
          className="text-sm text-[var(--ink-2)] hover:text-[var(--ink-1)] transition-colors"
        >
          ← Deals
        </Link>
        <div className="rounded-xl border border-[var(--line-1)] bg-[var(--surface-1)] px-4 py-16 text-center sm:px-5">
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

  const deal = await db.query.deals.findFirst({
    where: eq(schema.deals.id, numId),
    with: { contact: true },
  });

  if (!deal) notFound();

  const contact = deal.contact;

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/deals"
        className="text-sm text-[var(--ink-2)] hover:text-[var(--ink-1)] transition-colors"
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
        <div className="rounded-xl border border-[var(--line-1)] bg-[var(--surface-1)] p-4 sm:p-5">
          <h3 className="mb-3 text-sm font-medium text-[var(--ink-2)]">
            Linked contact
          </h3>
          <Link
            href={`/contacts/${contact.id}`}
            className="group flex items-center gap-3"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-sm font-medium text-[var(--ink-2)] transition-colors group-hover:bg-[var(--surface-3)]">
              {(contact.name[0] ?? "?").toUpperCase()}
            </span>
            <div>
              <p className="text-sm font-medium text-[var(--ink-1)] transition-colors group-hover:text-[var(--accent)]">
                {contact.name}
              </p>
              {(contact.title || contact.company) && (
                <p className="text-xs text-[var(--ink-2)]">
                  {[contact.title, contact.company].filter(Boolean).join(" · ")}
                </p>
              )}
              {contact.email && (
                <p className="text-xs text-[var(--ink-3)]">{contact.email}</p>
              )}
            </div>
          </Link>
        </div>
      ) : deal.contactId ? (
        <div className="rounded-xl border border-dashed border-[var(--line-1)] bg-[var(--surface-1)]/50 p-4 sm:p-5">
          <p className="text-xs text-[var(--ink-2)]">Contact was removed</p>
          <p className="mt-1 text-xs text-[var(--ink-3)]">
            The contact linked to this deal no longer exists and may have been
            deleted.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[var(--line-1)] bg-[var(--surface-1)]/50 p-4 sm:p-5">
          <p className="text-xs text-[var(--ink-3)]">No contact linked to this deal.</p>
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
      <div className="rounded-xl border border-[var(--line-1)] bg-[var(--surface-1)] p-4 sm:p-5">
        <h3 className="mb-4 text-sm font-medium text-[var(--ink-2)]">Notes</h3>
        <EditNotesForm dealId={deal.id} initialNotes={extractUserNotes(deal.notes)} />
      </div>

      {/* AI win-probability score */}
      <DealAiAccordion title="AI win score">
        <DealWinProbabilityPanel dealId={deal.id} initialScore={deal.probability} />
      </DealAiAccordion>

      {/* AI deal risk & next step */}
      <DealAiAccordion title="Deal risk & next step">
        <DealRiskPanel dealId={deal.id} />
      </DealAiAccordion>

      {/* AI deal brief */}
      <DealAiAccordion title="AI deal brief">
        <DealSummarizePanel
          dealId={deal.id}
          initialSummary={deal.aiSummary}
          initialSummaryAt={deal.aiSummaryAt}
        />
      </DealAiAccordion>

      {/* AI next best action */}
      <DealAiAccordion title="Next best action">
        <DealNextActionPanel
          dealId={deal.id}
          initialNextAction={deal.nextAction}
          initialNextActionAt={deal.nextActionAt}
        />
      </DealAiAccordion>

      {/* AI action items extractor */}
      <DealAiAccordion title="Action items">
        <ActionItemsPanel dealId={deal.id} />
      </DealAiAccordion>

      {/* Linked tasks */}
      <div className="rounded-xl border border-[var(--line-1)] bg-[var(--surface-1)] p-4 sm:p-5">
        <Suspense fallback={<SectionFallback />}>
          <LinkedTasksSection dealId={deal.id} />
        </Suspense>
      </div>

      {/* Activity timeline */}
      <div className="rounded-xl border border-[var(--line-1)] bg-[var(--surface-1)] p-4 sm:p-5">
        <Suspense fallback={<SectionFallback />}>
          <DealActivityTimeline dealId={deal.id} />
        </Suspense>
      </div>

      {/* Change log */}
      <div className="rounded-xl border border-[var(--line-1)] bg-[var(--surface-1)] p-4 sm:p-5">
        <Suspense fallback={<SectionFallback />}>
          <DealChangeLog dealId={deal.id} />
        </Suspense>
      </div>
    </div>
  );
}
