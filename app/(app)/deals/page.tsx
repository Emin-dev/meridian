import Link from "next/link";
import { getDb } from "@/db";

const STAGES = [
  { key: "lead" as const, label: "Lead", dot: "bg-blue-500" },
  { key: "qualified" as const, label: "Qualified", dot: "bg-violet-500" },
  { key: "proposal" as const, label: "Proposal", dot: "bg-yellow-500" },
  { key: "negotiation" as const, label: "Negotiation", dot: "bg-orange-500" },
  { key: "won" as const, label: "Won", dot: "bg-green-500" },
  { key: "lost" as const, label: "Lost", dot: "bg-red-500" },
];

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

export default async function DealsPage() {
  const db = getDb();

  const allDeals = db
    ? await db.query.deals.findMany({
        with: { contact: true },
        orderBy: (deals, { asc }) => [asc(deals.createdAt)],
      })
    : [];

  const byStage = Object.fromEntries(
    STAGES.map((s) => [s.key, allDeals.filter((d) => d.stage === s.key)])
  );

  const totalValue = allDeals
    .filter((d) => d.stage !== "lost" && d.value)
    .reduce((sum, d) => sum + parseFloat(d.value!), 0);

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
            <span className="text-sm text-neutral-400">
              Pipeline:{" "}
              <span className="font-semibold text-neutral-100">
                {new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: "USD",
                  maximumFractionDigits: 0,
                }).format(totalValue)}
              </span>
            </span>
          )}
          <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500">
            Add Deal
          </button>
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
      {db && (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4" style={{ minWidth: `${STAGES.length * 260}px` }}>
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
                      cards.map((deal) => {
                        const formatted = formatValue(deal.value, deal.currency);
                        return (
                          <div
                            key={deal.id}
                            className="rounded-lg border border-neutral-800 bg-neutral-800/50 p-3 transition-colors hover:border-neutral-700 hover:bg-neutral-800"
                          >
                            <p className="text-sm font-medium text-neutral-100 leading-snug">
                              {deal.title}
                            </p>
                            {formatted && (
                              <p className="mt-1 text-sm font-semibold text-indigo-400">
                                {formatted}
                              </p>
                            )}
                            {deal.contact && (
                              <Link
                                href={`/contacts/${deal.contact.id}`}
                                className="mt-2 flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
                              >
                                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-neutral-700 text-[10px] font-medium text-neutral-300">
                                  {deal.contact.name[0].toUpperCase()}
                                </span>
                                {deal.contact.name}
                              </Link>
                            )}
                            {deal.expectedCloseDate && (
                              <p className="mt-1.5 text-xs text-neutral-600">
                                Close:{" "}
                                {new Date(deal.expectedCloseDate).toLocaleDateString(
                                  "en-US",
                                  { month: "short", day: "numeric", year: "numeric" }
                                )}
                              </p>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
