import Link from "next/link";
import { and, asc, eq, isNotNull, ne, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { deals } from "@/db/schema";
import type { DealWithContact } from "./types";
import DealModal from "./deal-modal";
import DealsTable from "./deals-table";
import KanbanBoard from "./kanban-board";
import DealsExportCsvButton from "./export-csv-button";
import OwnerFilter from "./owner-filter";
import { DealsViewSwitcher } from "./deals-view-switcher";
import { getCrmSettings } from "@/lib/settings";
import { EmptyState } from "@/components/empty-state";
import { DemoDataButton } from "@/components/demo-data-button";

const PipelineIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
    <line x1="2" y1="20" x2="22" y2="20" />
  </svg>
);

const FilterIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);

const STAGES = [
  { key: "lead" as const, label: "Lead", dot: "bg-blue-500" },
  { key: "qualified" as const, label: "Qualified", dot: "bg-violet-500" },
  { key: "proposal" as const, label: "Proposal", dot: "bg-yellow-500" },
  { key: "negotiation" as const, label: "Negotiation", dot: "bg-orange-500" },
  { key: "won" as const, label: "Won", dot: "bg-green-500" },
  { key: "lost" as const, label: "Lost", dot: "bg-red-500" },
];

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; owner?: string; stage?: string }>;
}) {
  const { view = "kanban", owner: ownerFilter = "", stage: stageFilter = "" } = await searchParams;
  const isTable = view === "table";

  const db = getDb();

  // Validate stage filter against known stages.
  const stageMatch = STAGES.find((s) => s.key === stageFilter) ?? null;

  // Shared owner/stage filter for the visible list and the pipeline totals.
  const listFilter = and(
    ownerFilter ? eq(deals.owner, ownerFilter) : undefined,
    stageMatch ? eq(deals.stage, stageMatch.key) : undefined,
  );

  const [visibleDeals, totalsRows, ownerRows, countRows, allContacts, settings] =
    await Promise.all([
      // Filtered list (uses deals_owner_idx / deals_stage_idx).
      db
        ? db.query.deals.findMany({
            where: listFilter,
            with: { contact: true },
            orderBy: (d, { asc }) => [asc(d.createdAt)],
          })
        : Promise.resolve([] as DealWithContact[]),
      // Pipeline + weighted totals over open (non-lost) deals matching the filter.
      db
        ? db
            .select({
              pipeline: sql<string>`coalesce(sum(${deals.value}), 0)`,
              weighted: sql<string>`coalesce(sum(${deals.value} * ${deals.probability} / 100.0), 0)`,
            })
            .from(deals)
            .where(and(ne(deals.stage, "lost"), listFilter))
        : Promise.resolve([{ pipeline: "0", weighted: "0" }]),
      // Distinct non-null owners for the filter dropdown (across all deals).
      db
        ? db
            .selectDistinct({ owner: deals.owner })
            .from(deals)
            .where(isNotNull(deals.owner))
            .orderBy(asc(deals.owner))
        : Promise.resolve([] as { owner: string | null }[]),
      // Total deal count — drives whether the stats block renders.
      db
        ? db.select({ count: sql<number>`count(*)::int` }).from(deals)
        : Promise.resolve([{ count: 0 }]),
      db
        ? db.query.contacts.findMany({
            columns: { id: true, name: true },
            orderBy: (contacts, { asc }) => [asc(contacts.name)],
          })
        : Promise.resolve([] as { id: number; name: string }[]),
      getCrmSettings(),
    ]);

  const uniqueOwners = ownerRows
    .map((r) => r.owner)
    .filter((o): o is string => !!o);

  const totalDealCount = countRows[0]?.count ?? 0;
  const totalValue = parseFloat(totalsRows[0]?.pipeline ?? "0");
  const weightedValue = parseFloat(totalsRows[0]?.weighted ?? "0");

  const fmtCurrency = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[--ink-1]">Deals</h2>
          <p className="mt-1 text-sm text-[--ink-2]">
            Track your pipeline and close more revenue.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          {/* Pipeline / Weighted stats — stack above controls on mobile */}
          {totalDealCount > 0 && (
            <div className="flex flex-wrap items-center gap-4 text-sm text-[--ink-2]">
              <span>
                Pipeline:{" "}
                <span className="font-semibold text-[--ink-1]">
                  {fmtCurrency.format(totalValue)}
                </span>
              </span>
              <span aria-hidden className="text-[--ink-3]">|</span>
              <span>
                Weighted:{" "}
                <span className="font-semibold text-[--accent]">
                  {fmtCurrency.format(weightedValue)}
                </span>
              </span>
            </div>
          )}

          {/* Controls row — wraps on narrow viewports */}
          <div className="flex flex-wrap items-center gap-2">
            <OwnerFilter owners={uniqueOwners} selected={ownerFilter} />

            {/* Stage filter chip — shown when arriving from analytics funnel */}
            {stageMatch && (
              <div className="flex items-center gap-1.5 rounded-lg border border-[--line-1] bg-[--surface-2] px-2.5 text-xs text-[--ink-2]">
                <span className={`h-2 w-2 shrink-0 rounded-full ${stageMatch.dot}`} />
                <span>{stageMatch.label}</span>
                <Link
                  href={`?view=${view}${ownerFilter ? `&owner=${encodeURIComponent(ownerFilter)}` : ""}`}
                  className="tap ml-0.5 inline-flex items-center justify-center px-1 text-[--ink-3] hover:text-[--ink-1]"
                  aria-label="Clear stage filter"
                >
                  ×
                </Link>
              </div>
            )}

            {/* View toggle */}
            <DealsViewSwitcher
              currentView={isTable ? "table" : "kanban"}
              ownerParam={ownerFilter || undefined}
              stageParam={stageMatch?.key || undefined}
            />

            {isTable && (
              <DealsExportCsvButton
                hasDb={!!db}
                owner={ownerFilter || undefined}
                stage={stageMatch?.key || undefined}
              />
            )}

            <DealModal
              hasDb={!!db}
              contacts={allContacts}
              defaultCurrency={settings.defaultCurrency}
              defaultStage={settings.defaultDealStage}
            />
          </div>
        </div>
      </div>

      {/* No DB state */}
      {!db && (
        <div className="rounded-xl border border-[--line-1] bg-[--surface-1]">
          <EmptyState
            icon={<PipelineIcon />}
            title="Database not connected"
            description="Set DATABASE_URL to connect your Neon database."
          />
        </div>
      )}

      {/* Kanban board */}
      {db && !isTable && (
        visibleDeals.length === 0 ? (
          <div className="rounded-xl border border-[--line-1] bg-[--surface-1]">
            <EmptyState
              icon={(ownerFilter || stageMatch) ? <FilterIcon /> : <PipelineIcon />}
              title={
                stageMatch
                  ? `No deals in "${stageMatch.label}"`
                  : ownerFilter
                    ? `No deals for "${ownerFilter}"`
                    : "No deals yet"
              }
              description={
                (ownerFilter || stageMatch)
                  ? "Try clearing the filters to see all deals."
                  : "Add your first deal to start tracking your pipeline."
              }
              action={
                (ownerFilter || stageMatch) ? (
                  <Link
                    href="?view=kanban"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[--line-1] bg-[--surface-2] px-3 py-1.5 text-xs font-medium text-[--ink-2] transition-colors hover:bg-[--surface-3] hover:text-[--ink-1]"
                  >
                    Clear filters
                  </Link>
                ) : (
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <DealModal
                      hasDb={!!db}
                      contacts={allContacts}
                      defaultCurrency={settings.defaultCurrency}
                      defaultStage={settings.defaultDealStage}
                    />
                    <DemoDataButton
                      label="Load demo data"
                      className="inline-flex items-center gap-2 rounded-lg border border-[--line-1] bg-[--surface-2] px-3 py-1.5 text-xs font-medium text-[--ink-2] transition-colors hover:bg-[--surface-3] hover:text-[--ink-1] disabled:opacity-50"
                    />
                  </div>
                )
              }
            />
          </div>
        ) : (
          // Key by the active filter so a soft owner/stage navigation remounts
          // the board with the freshly-filtered deals. The key is invariant
          // across the post-move revalidatePath, so optimistic state survives.
          <KanbanBoard
            key={`${ownerFilter}::${stageMatch?.key ?? ""}`}
            initialDeals={visibleDeals}
          />
        )
      )}

      {/* Table view */}
      {db && isTable && (
        visibleDeals.length === 0 ? (
          <div className="rounded-xl border border-[--line-1] bg-[--surface-1]">
            <EmptyState
              icon={(ownerFilter || stageMatch) ? <FilterIcon /> : <PipelineIcon />}
              title={
                stageMatch
                  ? `No deals in "${stageMatch.label}"`
                  : ownerFilter
                    ? `No deals for "${ownerFilter}"`
                    : "No deals yet"
              }
              description={
                (ownerFilter || stageMatch)
                  ? "Try clearing the filters to see all deals."
                  : "Add your first deal to start tracking your pipeline."
              }
              action={
                (ownerFilter || stageMatch) ? (
                  <Link
                    href="?view=table"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[--line-1] bg-[--surface-2] px-3 py-1.5 text-xs font-medium text-[--ink-2] transition-colors hover:bg-[--surface-3] hover:text-[--ink-1]"
                  >
                    Clear filters
                  </Link>
                ) : (
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <DealModal
                      hasDb={!!db}
                      contacts={allContacts}
                      defaultCurrency={settings.defaultCurrency}
                      defaultStage={settings.defaultDealStage}
                    />
                    <DemoDataButton
                      label="Load demo data"
                      className="inline-flex items-center gap-2 rounded-lg border border-[--line-1] bg-[--surface-2] px-3 py-1.5 text-xs font-medium text-[--ink-2] transition-colors hover:bg-[--surface-3] hover:text-[--ink-1] disabled:opacity-50"
                    />
                  </div>
                )
              }
            />
          </div>
        ) : (
          <DealsTable deals={visibleDeals} owners={uniqueOwners} />
        )
      )}
    </div>
  );
}
