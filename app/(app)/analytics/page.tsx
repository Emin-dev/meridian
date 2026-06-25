import { getDb } from "@/db";

const STAGES = [
  { key: "lead" as const, label: "Lead", dot: "bg-blue-500" },
  { key: "qualified" as const, label: "Qualified", dot: "bg-violet-500" },
  { key: "proposal" as const, label: "Proposal", dot: "bg-yellow-500" },
  { key: "negotiation" as const, label: "Negotiation", dot: "bg-orange-500" },
  { key: "won" as const, label: "Won", dot: "bg-green-500" },
  { key: "lost" as const, label: "Lost", dot: "bg-red-500" },
];

// Ordered pipeline stages used to compute forward conversion rates
const PIPELINE_STAGES = [
  "lead",
  "qualified",
  "proposal",
  "negotiation",
  "won",
] as const;

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
        columns: {
          stage: true,
          value: true,
          createdAt: true,
          updatedAt: true,
        },
      })
    : [];

  // ── Summary stats ────────────────────────────────────────────────────────────
  const wonDeals = deals.filter((d) => d.stage === "won");
  const lostDeals = deals.filter((d) => d.stage === "lost");
  const closedCount = wonDeals.length + lostDeals.length;
  const winRate =
    closedCount > 0 ? (wonDeals.length / closedCount) * 100 : null;

  const wonWithValue = wonDeals.filter(
    (d) => d.value !== null && d.value !== undefined
  );
  const avgWonValue =
    wonWithValue.length > 0
      ? wonWithValue.reduce((sum, d) => sum + parseFloat(d.value!), 0) /
        wonWithValue.length
      : null;

  const activeDeals = deals.filter(
    (d) => d.stage !== "won" && d.stage !== "lost"
  );
  const totalPipeline = activeDeals
    .filter((d) => d.value !== null && d.value !== undefined)
    .reduce((sum, d) => sum + parseFloat(d.value!), 0);

  // Average days to close: createdAt → updatedAt for won deals
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  const avgDaysToClose =
    wonDeals.length > 0
      ? wonDeals.reduce((sum, d) => {
          const days =
            (d.updatedAt.getTime() - d.createdAt.getTime()) / MS_PER_DAY;
          return sum + days;
        }, 0) / wonDeals.length
      : null;

  // ── Stage funnel ─────────────────────────────────────────────────────────────
  const stageRows = STAGES.map((stage) => {
    const stageDeals = deals.filter((d) => d.stage === stage.key);
    const stageValue = stageDeals
      .filter((d) => d.value !== null && d.value !== undefined)
      .reduce((sum, d) => sum + parseFloat(d.value!), 0);
    return { ...stage, count: stageDeals.length, value: stageValue };
  });

  const maxCount = Math.max(...stageRows.map((s) => s.count), 1);

  // Conversion rate for each stage = count[stage] / count[prev stage]
  const countByKey = Object.fromEntries(stageRows.map((s) => [s.key, s.count]));
  const conversionRate: Record<string, number | null> = {};
  for (let i = 1; i < PIPELINE_STAGES.length; i++) {
    const prev = PIPELINE_STAGES[i - 1];
    const curr = PIPELINE_STAGES[i];
    const prevCount = countByKey[prev] ?? 0;
    conversionRate[curr] =
      prevCount > 0 ? ((countByKey[curr] ?? 0) / prevCount) * 100 : null;
  }

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
          {/* Summary stat cards — 4 cards: 1 col → 2 col → 4 col */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
            <StatCard
              label="Avg Days to Close"
              value={
                avgDaysToClose !== null ? `${Math.round(avgDaysToClose)}d` : "—"
              }
              subtext={
                wonDeals.length > 0
                  ? `across ${wonDeals.length} won deal${wonDeals.length !== 1 ? "s" : ""}`
                  : "No won deals yet"
              }
            />
          </div>

          {/* Stage funnel table */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-900">
            <div className="border-b border-neutral-800 px-6 py-4">
              <h3 className="text-sm font-semibold text-neutral-100">
                Stage Funnel
              </h3>
              <p className="mt-0.5 text-xs text-neutral-500">
                Deal count, total value, and forward conversion rate per stage
              </p>
            </div>

            {deals.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-neutral-600">
                No deals found. Add some deals to see analytics.
              </div>
            ) : (
              <>
                {/* Column headers */}
                <div className="flex items-center gap-4 border-b border-neutral-800 px-6 py-2">
                  <div className="w-28 shrink-0 text-xs font-medium uppercase tracking-wide text-neutral-600">
                    Stage
                  </div>
                  <div className="flex-1" />
                  <div className="w-10 shrink-0 text-right text-xs font-medium uppercase tracking-wide text-neutral-600">
                    Deals
                  </div>
                  <div className="w-28 shrink-0 text-right text-xs font-medium uppercase tracking-wide text-neutral-600">
                    Value
                  </div>
                  <div className="w-24 shrink-0 text-right text-xs font-medium uppercase tracking-wide text-neutral-600">
                    Conv. Rate
                  </div>
                </div>

                <div className="divide-y divide-neutral-800">
                  {stageRows.map((stage) => {
                    const conv = conversionRate[stage.key];
                    const convColor =
                      conv == null
                        ? ""
                        : conv >= 50
                          ? "text-green-400"
                          : conv >= 25
                            ? "text-yellow-400"
                            : "text-red-400";
                    return (
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

                        {/* Progress bar */}
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

                        {/* Conversion rate */}
                        <div className="w-24 shrink-0 text-right text-sm">
                          {conv != null ? (
                            <span className={convColor}>
                              {conv.toFixed(0)}%
                            </span>
                          ) : (
                            <span className="text-neutral-700">—</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="border-t border-neutral-800 px-6 py-3">
                  <p className="text-xs text-neutral-600">
                    Conv. Rate = deals in this stage ÷ deals in the previous
                    stage. Lead and Lost stages have no forward conversion.
                  </p>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
