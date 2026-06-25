import Link from "next/link";
import { getDb } from "@/db";
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

  const [[allDeals, allContacts], settings] = await Promise.all([
    db
      ? Promise.all([
          db.query.deals.findMany({
            with: { contact: true },
            orderBy: (deals, { asc }) => [asc(deals.createdAt)],
          }),
          db.query.contacts.findMany({
            columns: { id: true, name: true },
            orderBy: (contacts, { asc }) => [asc(contacts.name)],
          }),
        ])
      : Promise.resolve([[], []] as [never[], never[]]),
    getCrmSettings(),
  ]);

  // Collect unique owners for the filter dropdown (from all deals).
  const uniqueOwners = Array.from(
    new Set(allDeals.map((d) => d.owner).filter((o): o is string => !!o))
  ).sort();

  // Validate stage filter against known stages.
  const stageMatch = STAGES.find((s) => s.key === stageFilter) ?? null;

  // Apply owner and stage filters.
  const visibleDeals = allDeals.filter(
    (d) =>
      (!ownerFilter || d.owner === ownerFilter) &&
      (!stageMatch || d.stage === stageMatch.key)
  );

  const openDeals = visibleDeals.filter((d) => d.stage !== "lost");

  const totalValue = openDeals
    .filter((d) => d.value)
    .reduce((sum, d) => sum + parseFloat(d.value!), 0);

  const weightedValue = openDeals
    .filter((d) => d.value)
    .reduce((sum, d) => sum + parseFloat(d.value!) * ((d.probability ?? 0) / 100), 0);

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
          <h2 className="text-xl font-semibold text-neutral-100">Deals</h2>
          <p className="mt-1 text-sm text-neutral-400">
            Track your pipeline and close more revenue.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          {/* Pipeline / Weighted stats — stack above controls on mobile */}
          {allDeals.length > 0 && (
            <div className="flex flex-wrap items-center gap-4 text-sm text-neutral-400">
              <span>
                Pipeline:{" "}
                <span className="font-semibold text-neutral-100">
                  {fmtCurrency.format(totalValue)}
                </span>
              </span>
              <span aria-hidden className="text-neutral-700">|</span>
              <span>
                Weighted:{" "}
                <span className="font-semibold text-indigo-300">
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
              <div className="flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800 px-2.5 text-xs text-neutral-300">
                <span className={`h-2 w-2 shrink-0 rounded-full ${stageMatch.dot}`} />
                <span>{stageMatch.label}</span>
                <Link
                  href={`?view=${view}${ownerFilter ? `&owner=${encodeURIComponent(ownerFilter)}` : ""}`}
                  className="tap ml-0.5 inline-flex items-center justify-center px-1 text-neutral-500 hover:text-neutral-200"
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
            />

            {isTable && <DealsExportCsvButton hasDb={!!db} />}

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
        <div className="rounded-xl border border-neutral-800 bg-neutral-900">
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
          <div className="rounded-xl border border-neutral-800 bg-neutral-900">
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
                    className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-300 transition-colors hover:bg-neutral-700 hover:text-neutral-100"
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
                      className="inline-flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-400 transition-colors hover:bg-neutral-700 hover:text-neutral-200 disabled:opacity-50"
                    />
                  </div>
                )
              }
            />
          </div>
        ) : (
          <KanbanBoard initialDeals={visibleDeals} />
        )
      )}

      {/* Table view */}
      {db && isTable && (
        visibleDeals.length === 0 ? (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900">
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
                    className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-300 transition-colors hover:bg-neutral-700 hover:text-neutral-100"
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
                      className="inline-flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-400 transition-colors hover:bg-neutral-700 hover:text-neutral-200 disabled:opacity-50"
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
