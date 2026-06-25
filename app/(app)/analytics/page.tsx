import { getDb } from "@/db";

const STAGES = [
  { key: "lead" as const, label: "Lead", dot: "bg-blue-500" },
  { key: "qualified" as const, label: "Qualified", dot: "bg-violet-500" },
  { key: "proposal" as const, label: "Proposal", dot: "bg-yellow-500" },
  { key: "negotiation" as const, label: "Negotiation", dot: "bg-orange-500" },
  { key: "won" as const, label: "Won", dot: "bg-green-500" },
  { key: "lost" as const, label: "Lost", dot: "bg-red-500" },
];

function fmtUSD(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function StatCard({
  label,
  value,
  subtext,
}: {
  label: string;
  value: string;
  subtext: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-5 py-4">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-neutral-100">{value}</p>
      <p className="mt-1 text-xs text-neutral-500">{subtext}</p>
    </div>
  );
}

export default async function AnalyticsPage() {
  const db = getDb();

  const deals = db
    ? await db.query.deals.findMany({
        columns: { stage: true, value: true },
      })
    : [];

  // Summary stats
  const wonDeals = deals.filter((d) => d.stage === "won");
  const lostDeals = deals.filter((d) => d.stage === "lost");
  const closedCount = wonDeals.length + lostDeals.length;
  const winRate = closedCount > 0 ? (wonDeals.length / closedCount) * 100 : null;

  const wonWithValue = wonDeals.filter((d) => d.value !== null && d.value !== undefined);
  const avgWonValue =
    wonWithValue.length > 0
      ? wonWithValue.reduce((sum, d) => sum + parseFloat(d.value!), 0) /
        wonWithValue.length
      : null;

  const activeDeals = deals.filter((d) => d.stage !== "won" && d.stage !== "lost");
  const totalPipeline = activeDeals
    .filter((d) => d.value !== null && d.value !== undefined)
    .reduce((sum, d) => sum + parseFloat(d.value!), 0);

  // Stage funnel
  const stageRows = STAGES.map((stage) => {
    const stageDeals = deals.filter((d) => d.stage === stage.key);
    const stageValue = stageDeals
      .filter((d) => d.value !== null && d.value !== undefined)
      .reduce((sum, d) => sum + parseFloat(d.value!), 0);
    return { ...stage, count: stageDeals.length, value: stageValue };
  });

  const maxCount = Math.max(...stageRows.map((s) => s.count), 1);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-neutral-100">Analytics</h2>
        <p className="mt-1 text-sm text-neutral-400">
          Pipeline performance and deal conversion metrics.
        </p>
      </div>

      {/* No DB state */}
      {!db && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900 px-5 py-16 text-center">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-neutral-700"
          >
            <line x1="18" x2="18" y1="20" y2="10" />
            <line x1="12" x2="12" y1="20" y2="4" />
            <line x1="6" x2="6" y1="20" y2="14" />
          </svg>
          <p className="text-sm text-neutral-400">Database not connected.</p>
          <p className="text-xs text-neutral-600">
            Set DATABASE_URL to connect your Neon database.
          </p>
        </div>
      )}

      {db && (
        <>
          {/* Summary stat cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              label="Win Rate"
              value={winRate !== null ? `${winRate.toFixed(1)}%` : "—"}
              subtext={
                closedCount > 0
                  ? `${wonDeals.length} won of ${closedCount} closed`
                  : "No closed deals yet"
              }
            />
            <StatCard
              label="Avg Won Deal Value"
              value={avgWonValue !== null ? fmtUSD(avgWonValue) : "—"}
              subtext={
                wonWithValue.length > 0
                  ? `across ${wonWithValue.length} won deal${wonWithValue.length !== 1 ? "s" : ""}`
                  : "No won deals with value"
              }
            />
            <StatCard
              label="Total Pipeline Value"
              value={fmtUSD(totalPipeline)}
              subtext={`${activeDeals.length} active deal${activeDeals.length !== 1 ? "s" : ""}`}
            />
          </div>

          {/* Stage funnel table */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-900">
            <div className="border-b border-neutral-800 px-6 py-4">
              <h3 className="text-sm font-semibold text-neutral-100">
                Stage Funnel
              </h3>
              <p className="mt-0.5 text-xs text-neutral-500">
                Deal count and total value per pipeline stage
              </p>
            </div>

            {deals.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-neutral-600">
                No deals found. Add some deals to see analytics.
              </div>
            ) : (
              <div className="divide-y divide-neutral-800">
                {stageRows.map((stage) => (
                  <div
                    key={stage.key}
                    className="flex items-center gap-4 px-6 py-3"
                  >
                    {/* Stage label */}
                    <div className="flex w-28 shrink-0 items-center gap-2">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${stage.dot}`}
                      />
                      <span className="text-sm text-neutral-300">
                        {stage.label}
                      </span>
                    </div>

                    {/* Bar */}
                    <div className="flex-1">
                      <div className="h-1.5 rounded-full bg-neutral-800">
                        <div
                          className={`h-1.5 rounded-full ${stage.dot} opacity-60 transition-all duration-300`}
                          style={{
                            width:
                              stage.count > 0
                                ? `${(stage.count / maxCount) * 100}%`
                                : "0%",
                          }}
                        />
                      </div>
                    </div>

                    {/* Count */}
                    <div className="w-10 shrink-0 text-right text-sm font-semibold text-neutral-200">
                      {stage.count}
                    </div>

                    {/* Value */}
                    <div className="w-28 shrink-0 text-right text-sm text-neutral-400">
                      {stage.value > 0 ? fmtUSD(stage.value) : "—"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
