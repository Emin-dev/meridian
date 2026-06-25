import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import EditNotesForm from "./edit-notes-form";
import EditDealForm from "./edit-deal-form";
import DeleteDealButton from "./delete-deal-button";
import DealActivityTimeline from "./deal-activity-timeline";
import DealSummarizePanel from "./deal-summarize-panel";
import DealWinProbabilityPanel from "./deal-win-probability-panel";
import DealNextActionPanel from "./deal-next-action-panel";
import StageControl from "../stage-control";
import WinLossInsightCallout from "./win-loss-insight-callout";
import { extractUserNotes, extractWinLossInsight } from "./notes-utils";
import LinkedTasksSection from "@/app/(app)/tasks/linked-tasks-section";

interface Props {
  params: Promise<{ id: string }>;
}

const STAGE_META = {
  lead: { label: "Lead", color: "text-blue-400", bg: "bg-blue-900/20" },
  qualified: {
    label: "Qualified",
    color: "text-purple-400",
    bg: "bg-purple-900/20",
  },
  proposal: {
    label: "Proposal",
    color: "text-yellow-400",
    bg: "bg-yellow-900/20",
  },
  negotiation: {
    label: "Negotiation",
    color: "text-orange-400",
    bg: "bg-orange-900/20",
  },
  won: { label: "Won", color: "text-green-400", bg: "bg-green-900/20" },
  lost: { label: "Lost", color: "text-red-400", bg: "bg-red-900/20" },
} as const;

function formatValue(value: string | null, currency: string) {
  if (!value) return null;
  const num = parseFloat(value);
  if (isNaN(num)) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(num);
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

  const stageMeta = STAGE_META[deal.stage];
  const formatted = formatValue(deal.value, deal.currency);

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/deals"
        className="text-sm text-neutral-400 hover:text-neutral-100 transition-colors"
      >
        ← Deals
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-neutral-100">{deal.title}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${stageMeta.bg} ${stageMeta.color}`}
            >
              {stageMeta.label}
            </span>
            {formatted && (
              <span className="text-sm font-semibold text-indigo-400">
                {formatted}
              </span>
            )}
            {deal.expectedCloseDate && (
              <span className="text-xs text-neutral-500">
                Close:{" "}
                {new Date(deal.expectedCloseDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            )}
          </div>
          {(deal.stage === "won" || deal.stage === "lost") &&
            deal.closeReason && (
              <p className="mt-1.5 text-xs text-neutral-400">
                <span className="text-neutral-600">Reason: </span>
                {deal.closeReason}
              </p>
            )}
          <StageControl dealId={deal.id} stage={deal.stage} />
        </div>
        <DeleteDealButton dealId={deal.id} />
      </div>

      {/* Edit deal details */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-6 py-5">
        <h3 className="mb-4 text-sm font-medium text-neutral-300">Details</h3>
        <EditDealForm deal={deal} />
        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-neutral-800 pt-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-neutral-500">Created</dt>
            <dd className="mt-0.5 text-neutral-200">
              {deal.createdAt.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Last updated</dt>
            <dd className="mt-0.5 text-neutral-200">
              {deal.updatedAt.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </dd>
          </div>
        </dl>
      </div>

      {/* Linked contact */}
      {contact ? (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-6 py-5">
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
      ) : (
        <div className="rounded-xl border border-dashed border-neutral-800 bg-neutral-900/50 px-6 py-4">
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
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-6 py-5">
        <h3 className="mb-4 text-sm font-medium text-neutral-300">Notes</h3>
        <EditNotesForm dealId={deal.id} initialNotes={extractUserNotes(deal.notes)} />
      </div>

      {/* AI win-probability score */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-6 py-5">
        <DealWinProbabilityPanel dealId={deal.id} initialScore={deal.probability} />
      </div>

      {/* AI deal brief */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-6 py-5">
        <DealSummarizePanel dealId={deal.id} />
      </div>

      {/* AI next best action */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-6 py-5">
        <DealNextActionPanel dealId={deal.id} />
      </div>

      {/* Linked tasks */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-6 py-5">
        <LinkedTasksSection dealId={deal.id} />
      </div>

      {/* Activity timeline */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-6 py-5">
        <DealActivityTimeline dealId={deal.id} />
      </div>
    </div>
  );
}
