import Link from "next/link";
import { getDb } from "@/db";
import DealModal from "./deal-modal";
import DealsTable from "./deals-table";
import { getCrmSettings } from "@/lib/settings";

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
  searchParams: Promise<{ view?: string }>;
}) {
  const { view = "kanban" } = await searchParams;
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

  const byStage = Object.fromEntries(
    STAGES.map((s) => [s.key, allDeals.filter((d) => d.stage === s.key)])
  );

  const openDeals = allDeals.filter((d) => d.stage !== "lost");

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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-neutral-100">Deals</h2>
          <p className="mt-1 text-sm text-neutral-400">
            Track your pipeline and close more revenue.
          </p>
        </div>
        <div className="flex items-center gap-4">
          {allDeals.length > 0 && (
            <div className="flex items-center gap-4 text-sm text-neutral-400">
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

          {/* View toggle */}
          <div className="flex items-center rounded-lg border border-neutral-700 bg-neutral-900 p-0.5">
            <Link
              href="?view=kanban"
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                !isTable
                  ? "bg-neutral-700 text-neutral-100"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
              aria-label="Kanban view"
            >
              {/* Kanban icon */}
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="1" width="3" height="12" rx="1" fill="currentColor" opacity="0.9" />
                <rect x="5.5" y="1" width="3" height="8" rx="1" fill="currentColor" opacity="0.9" />
                <rect x="10" y="1" width="3" height="10" rx="1" fill="currentColor" opacity="0.9" />
              </svg>
              Kanban
            </Link>
            <Link
              href="?view=table"
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                isTable
                  ? "bg-neutral-700 text-neutral-100"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
              aria-label="Table view"
            >
              {/* Table icon */}
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="1" width="12" height="3" rx="1" fill="currentColor" opacity="0.9" />
                <rect x="1" y="5.5" width="12" height="2" rx="0.5" fill="currentColor" opacity="0.6" />
                <rect x="1" y="9" width="12" height="2" rx="0.5" fill="currentColor" opacity="0.6" />
                <rect x="1" y="12" width="12" height="1" rx="0.5" fill="currentColor" opacity="0.4" />
              </svg>
              Table
            </Link>
          </div>

          <DealModal
            hasDb={!!db}
            contacts={allContacts}
            defaultCurrency={settings.defaultCurrency}
            defaultStage={settings.defaultDealStage}
          />
        </div>
      </div>

      {/* No DB state */}
      {!db && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900 px-5 py-16 text-center">
          <p className="text-sm text-neutral-400">Database not connected.</p>
          <p className="text-xs text-neutral-600">
            Set DATABASE_URL to connect your Neon database.
          </p>
        </div>
      )}

      {/* Kanban board */}
      {db && !isTable && (
        <div className="overflow-x-auto pb-4">
          <div
            className="flex gap-4"
            style={{ minWidth: `${STAGES.length * 260}px` }}
          >
            {STAGES.map((stage) => {
              const cards = byStage[stage.key] ?? [];
              const stageTotal = cards
                .filter((d) => d.value)
                .reduce((sum, d) => sum + parseFloat(d.value!), 0);

              return (
                <div
                  key={stage.key}
                  className="flex w-60 flex-none flex-col rounded-xl border border-neutral-800 bg-neutral-900"
                >
                  {/* Column header */}
                  <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${stage.dot}`} />
                      <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                        {stage.label}
                      </span>
                    </div>
                    <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-xs text-neutral-400">
                      {cards.length}
                    </span>
                  </div>

                  {/* Stage value */}
                  {stageTotal > 0 && (
                    <div className="border-b border-neutral-800 px-4 py-2">
                      <p className="text-xs text-neutral-500">
                        {new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: "USD",
                          maximumFractionDigits: 0,
                        }).format(stageTotal)}
                      </p>
                    </div>
                  )}

                  {/* Cards */}
                  <div className="flex flex-1 flex-col gap-3 p-3">
                    {cards.length === 0 ? (
                      <p className="py-6 text-center text-xs text-neutral-700">
                        No deals
                      </p>
                    ) : (
                      cards.map((deal) => (
                        <DealModal
                          key={deal.id}
                          deal={deal}
                          hasDb={!!db}
                          contacts={allContacts}
                          defaultCurrency={settings.defaultCurrency}
                          defaultStage={settings.defaultDealStage}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Table view */}
      {db && isTable && <DealsTable deals={allDeals} />}
    </div>
  );
}
