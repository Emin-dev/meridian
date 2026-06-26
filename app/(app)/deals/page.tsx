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
import { STAGES } from "./stages";
import { getCrmSettings } from "@/lib/settings";
import { EmptyState } from "@/components/empty-state";
import EmptyStateActions from "@/components/empty-state-actions";
import { formatCurrency } from "@/lib/format";

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

// Bound the deals query so a request never triggers an un-paginated full-table
// scan. We fetch the most recent deals up to this cap; older ones stay reachable
// via the owner/stage filters, and a "showing N of M" note flags when capped.
const DEALS_LIMIT = 200;
// Cap the contact-picker options for the new-deal modal; it only needs a usable
// shortlist, not the entire contacts table.
const CONTACTS_LIMIT = 500;

// Table-view sortable columns. Driven via URL params so ordering is computed in
// the DB across the full filtered set, not just the capped page of loaded rows.
// "contact" is intentionally excluded: it lives on a joined relation and can't
// be ordered correctly within the cap without a join.
const VALID_DEAL_SORT_COLS = ["title", "stage", "value", "closeDate", "owner", "age"] as const;
type DealSortCol = (typeof VALID_DEAL_SORT_COLS)[number];

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; owner?: string; stage?: string; sort?: string; dir?: string }>;
}) {
  const { view = "kanban", owner: ownerFilter = "", stage: stageFilter = "", sort, dir } = await searchParams;
  const isTable = view === "table";

  // Table sort (default: oldest-open first, i.e. age desc). Kanban ignores this.
  const sortColKey: DealSortCol =
    sort && (VALID_DEAL_SORT_COLS as readonly string[]).includes(sort)
      ? (sort as DealSortCol)
      : "age";
  const sortDir: "asc" | "desc" = dir === "asc" ? "asc" : "desc";

  const db = getDb();

  // Validate stage filter against known stages.
  const stageMatch = STAGES.find((s) => s.key === stageFilter) ?? null;

  // Shared owner/stage filter for the visible list and the pipeline totals.
  const listFilter = and(
    ownerFilter ? eq(deals.owner, ownerFilter) : undefined,
    stageMatch ? eq(deals.stage, stageMatch.key) : undefined,
  );

  const [visibleDealsRaw, totalsRows, ownerRows, countRows, allContacts, settings] =
    await Promise.all([
      // Filtered list (uses deals_owner_idx / deals_stage_idx), capped at
      // DEALS_LIMIT. Table view orders by the chosen column so the cap keeps the
      // correct top-N across the full filtered set; kanban fetches newest-first
      // (reversed below to restore ascending display order). An `id` tiebreaker
      // keeps the capped window deterministic when the sort key has ties.
      db
        ? db.query.deals.findMany({
            where: listFilter,
            with: { contact: true },
            orderBy: isTable
              ? (d, { asc, desc }) => {
                  const dirFn = sortDir === "asc" ? asc : desc;
                  switch (sortColKey) {
                    case "title":
                      return [dirFn(d.title), asc(d.id)];
                    case "stage":
                      return [dirFn(d.stage), asc(d.id)];
                    case "value":
                      return [dirFn(d.value), asc(d.id)];
                    case "closeDate":
                      return [dirFn(d.expectedCloseDate), asc(d.id)];
                    case "owner":
                      return [dirFn(d.owner), asc(d.id)];
                    case "age":
                    default:
                      // Age = now − createdAt, so older deals (smaller createdAt)
                      // have a larger age. Invert: age desc ⇔ createdAt asc.
                      return [(sortDir === "asc" ? desc : asc)(d.createdAt), asc(d.id)];
                  }
                }
              : (d, { desc }) => [desc(d.createdAt)],
            limit: DEALS_LIMIT,
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
      // Count of deals matching the filter — drives the stats block and the
      // "showing N of M" affordance when the list is capped.
      db
        ? db
            .select({ count: sql<number>`count(*)::int` })
            .from(deals)
            .where(listFilter)
        : Promise.resolve([{ count: 0 }]),
      db
        ? db.query.contacts.findMany({
            columns: { id: true, name: true },
            orderBy: (contacts, { asc }) => [asc(contacts.name)],
            limit: CONTACTS_LIMIT,
          })
        : Promise.resolve([] as { id: number; name: string }[]),
      getCrmSettings(),
    ]);

  // Table view is already in its final sort order; kanban restores ascending
  // (oldest-first) display order after the newest-first fetch.
  const visibleDeals = isTable ? visibleDealsRaw : visibleDealsRaw.slice().reverse();

  const uniqueOwners = ownerRows
    .map((r) => r.owner)
    .filter((o): o is string => !!o);

  const matchingDealCount = countRows[0]?.count ?? 0;
  const totalValue = parseFloat(totalsRows[0]?.pipeline ?? "0");
  const weightedValue = parseFloat(totalsRows[0]?.weighted ?? "0");

  // Aggregate totals (pipeline/weighted/stage) should be labelled in the same
  // currency as the per-deal cards rather than a hardcoded USD. Deals carry
  // their own currency; in practice the set is single-currency, so display the
  // currency of the loaded deals, falling back to the configured default when
  // there are none (the stats block is hidden in that case anyway).
  const displayCurrency = visibleDeals[0]?.currency ?? settings.defaultCurrency;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[var(--ink-1)]">Deals</h2>
          <p className="mt-1 text-sm text-[var(--ink-2)]">
            Track your pipeline and close more revenue.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          {/* Pipeline / Weighted stats — stack above controls on mobile */}
          {matchingDealCount > 0 && (
            <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--ink-2)]">
              <span>
                Pipeline:{" "}
                <span className="font-semibold text-[var(--ink-1)]">
                  {formatCurrency(totalValue, displayCurrency)}
                </span>
              </span>
              <span aria-hidden className="text-[var(--ink-3)]">|</span>
              <span>
                Weighted:{" "}
                <span className="font-semibold text-[var(--accent-text)]">
                  {formatCurrency(weightedValue, displayCurrency)}
                </span>
              </span>
            </div>
          )}

          {/* Controls row — wraps on narrow viewports */}
          <div className="flex flex-wrap items-center gap-2">
            <OwnerFilter owners={uniqueOwners} selected={ownerFilter} />

            {/* Stage filter chip — shown when arriving from analytics funnel */}
            {stageMatch && (
              <div className="flex items-center gap-1.5 rounded-lg border border-[var(--line-1)] bg-[var(--surface-2)] px-2.5 text-xs text-[var(--ink-2)]">
                <span className={`h-2 w-2 shrink-0 rounded-full ${stageMatch.dot}`} />
                <span>{stageMatch.label}</span>
                <Link
                  href={`?view=${view}${ownerFilter ? `&owner=${encodeURIComponent(ownerFilter)}` : ""}`}
                  className="tap ml-0.5 inline-flex items-center justify-center px-1 text-[var(--ink-3)] hover:text-[var(--ink-1)]"
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
        <div className="rounded-xl border border-[var(--line-1)] bg-[var(--surface-1)]">
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
          <div className="rounded-xl border border-[var(--line-1)] bg-[var(--surface-1)]">
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
                <EmptyStateActions
                  clearFiltersHref={(ownerFilter || stageMatch) ? "?view=kanban" : undefined}
                  primaryAction={
                    <DealModal
                      hasDb={!!db}
                      contacts={allContacts}
                      defaultCurrency={settings.defaultCurrency}
                      defaultStage={settings.defaultDealStage}
                    />
                  }
                />
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
            currency={displayCurrency}
          />
        )
      )}

      {/* Table view */}
      {db && isTable && (
        visibleDeals.length === 0 ? (
          <div className="rounded-xl border border-[var(--line-1)] bg-[var(--surface-1)]">
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
                <EmptyStateActions
                  clearFiltersHref={(ownerFilter || stageMatch) ? "?view=table" : undefined}
                  primaryAction={
                    <DealModal
                      hasDb={!!db}
                      contacts={allContacts}
                      defaultCurrency={settings.defaultCurrency}
                      defaultStage={settings.defaultDealStage}
                    />
                  }
                />
              }
            />
          </div>
        ) : (
          <DealsTable
            deals={visibleDeals}
            owners={uniqueOwners}
            sort={sortColKey}
            dir={sortDir}
            allSearchParams={{
              view: "table",
              ...(ownerFilter ? { owner: ownerFilter } : {}),
              ...(stageMatch ? { stage: stageMatch.key } : {}),
            }}
          />
        )
      )}

      {/* Capped-list affordance — only when more deals match than are shown */}
      {db && visibleDeals.length > 0 && matchingDealCount > visibleDeals.length && (
        <p className="text-center text-xs text-[var(--ink-3)]">
          Showing {visibleDeals.length} of {matchingDealCount} deals — use the
          filters above to narrow the list.
        </p>
      )}
    </div>
  );
}
