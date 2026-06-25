import Link from "next/link";
import { gte } from "drizzle-orm";
import { getDb, schema } from "@/db";

const CONTACT_STATUSES = [
  { key: "lead" as const, label: "Lead", dot: "bg-blue-500" },
  { key: "active" as const, label: "Active", dot: "bg-green-500" },
  { key: "inactive" as const, label: "Inactive", dot: "bg-neutral-500" },
  { key: "churned" as const, label: "Churned", dot: "bg-red-500" },
];

const CONTACT_SOURCES = [
  { key: "website" as const, label: "Website", dot: "bg-cyan-500" },
  { key: "referral" as const, label: "Referral", dot: "bg-violet-500" },
  { key: "linkedin" as const, label: "LinkedIn", dot: "bg-blue-400" },
  { key: "cold-outreach" as const, label: "Cold Outreach", dot: "bg-orange-500" },
  { key: "other" as const, label: "Other", dot: "bg-neutral-500" },
];

const STAGES = [
  { key: "lead" as const, label: "Lead", dot: "bg-blue-500" },
  { key: "qualified" as const, label: "Qualified", dot: "bg-violet-500" },
  { key: "proposal" as const, label: "Proposal", dot: "bg-yellow-500" },
  { key: "negotiation" as const, label: "Negotiation", dot: "bg-orange-500" },
  { key: "won" as const, label: "Won", dot: "bg-green-500" },
  { key: "lost" as const, label: "Lost", dot: "bg-red-500" },
];

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

export default async function AnalyticsBody({ days }: { days: string }) {
  const since: Date | null = days
    ? new Date(Date.now() - parseInt(days, 10) * 24 * 60 * 60 * 1000)
    : null;

  const db = getDb();

  const deals = db
    ? await db.query.deals.findMany({
        columns: {
          stage: true,
          value: true,
          probability: true,
          expectedCloseDate: true,
          createdAt: true,
          updatedAt: true,
        },
        where: since ? gte(schema.deals.createdAt, since) : undefined,
      })
    : [];

  const contacts = db
    ? await db.query.contacts.findMany({
        columns: { status: true, source: true },
        where: since ? gte(schema.contacts.createdAt, since) : undefined,
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

  // ── Pipeline forecast (next 6 months by expectedCloseDate) ─────────────────
  const now = new Date();
  const forecastMonths = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    return {
      year: d.getFullYear(),
      month: d.getMonth(),
      label: d.toLocaleString("en-US", { month: "short", year: "2-digit" }),
      raw: 0,
      weighted: 0,
    };
  });
  for (const deal of activeDeals) {
    if (!deal.expectedCloseDate || deal.value === null || deal.value === undefined)
      continue;
    const y = deal.expectedCloseDate.getFullYear();
    const m = deal.expectedCloseDate.getMonth();
    const bucket = forecastMonths.find((b) => b.year === y && b.month === m);
    if (!bucket) continue;
    const val = parseFloat(deal.value);
    bucket.raw += val;
    bucket.weighted += val * ((deal.probability ?? 10) / 100);
  }
  const maxForecastVal = Math.max(...forecastMonths.map((b) => b.raw), 1);
  const hasForecastData = forecastMonths.some((b) => b.raw > 0);

  // Average days to close: createdAt → updatedAt for won deals
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  const avgDaysToClose =
    wonDeals.length > 0
      ? wonDeals.reduce((sum, d) => {
          const closeDays =
            (d.updatedAt.getTime() - d.createdAt.getTime()) / MS_PER_DAY;
          return sum + closeDays;
        }, 0) / wonDeals.length
      : null;

  // ── Won deals per month ───────────────────────────────────────────────────────
  const closedChartMonths = since
    ? Math.min(
        Math.max(
          (now.getFullYear() - since.getFullYear()) * 12 +
            (now.getMonth() - since.getMonth()) +
            1,
          1
        ),
        6
      )
    : 6;

  const monthBuckets = Array.from({ length: closedChartMonths }, (_, i) => {
    const d = new Date(
      now.getFullYear(),
      now.getMonth() - (closedChartMonths - 1 - i),
      1
    );
    return {
      year: d.getFullYear(),
      month: d.getMonth(),
      label: d.toLocaleString("en-US", { month: "short", year: "numeric" }),
      count: 0,
    };
  });
  const wonDealsForChart = since
    ? wonDeals.filter((d) => d.updatedAt >= since)
    : wonDeals;
  for (const deal of wonDealsForChart) {
    const y = deal.updatedAt.getFullYear();
    const m = deal.updatedAt.getMonth();
    const bucket = monthBuckets.find((b) => b.year === y && b.month === m);
    if (bucket) bucket.count++;
  }
  const maxMonthCount = Math.max(...monthBuckets.map((b) => b.count), 1);
  const hasMonthData = wonDealsForChart.length > 0;

  // ── Stage funnel ─────────────────────────────────────────────────────────────
  const stageRows = STAGES.map((stage) => {
    const stageDeals = deals.filter((d) => d.stage === stage.key);
    const stageValue = stageDeals
      .filter((d) => d.value !== null && d.value !== undefined)
      .reduce((sum, d) => sum + parseFloat(d.value!), 0);
    return { ...stage, count: stageDeals.length, value: stageValue };
  });

  const maxCount = Math.max(...stageRows.map((s) => s.count), 1);

  // ── Contacts analytics ───────────────────────────────────────────────────────
  const statusRows = CONTACT_STATUSES.map((s) => ({
    ...s,
    count: contacts.filter((c) => c.status === s.key).length,
  }));
  const maxStatusCount = Math.max(...statusRows.map((s) => s.count), 1);

  const sourceRows = CONTACT_SOURCES.map((s) => ({
    ...s,
    count: contacts.filter((c) => c.source === s.key).length,
  }));
  const maxSourceCount = Math.max(...sourceRows.map((s) => s.count), 1);

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
    <>
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
          {/* Summary stat cards — container query: 1→2→4 cols */}
          <div className="@container">
            <div className="grid grid-cols-1 gap-4 @sm:grid-cols-2 @xl:grid-cols-4">
              <StatCard
                label="Win Rate"
                value={winRate !== null ? `${winRate.toFixed(1)}%` : "—"}
                subtext={
                  closedCount > 0
                    ? `${wonDeals.length} won of ${closedCount} closed`
                    : days
                      ? "No closed deals in this range"
                      : "No closed deals yet"
                }
              />
              <StatCard
                label="Avg Won Deal Value"
                value={avgWonValue !== null ? fmtUSD(avgWonValue) : "—"}
                subtext={
                  wonWithValue.length > 0
                    ? `across ${wonWithValue.length} won deal${wonWithValue.length !== 1 ? "s" : ""}`
                    : days
                      ? "No won deals in this range"
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
                    : days
                      ? "No won deals in this range"
                      : "No won deals yet"
                }
              />
            </div>
          </div>

          {/* Stage funnel — @container for responsive rows */}
          <div className="@container rounded-xl border border-neutral-800 bg-neutral-900">
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
                {days
                  ? "No deals in this time range."
                  : "No deals found. Add some deals to see analytics."}
              </div>
            ) : (
              <>
                {/* Column headers: only on wide containers */}
                <div className="hidden @[30rem]:flex items-center gap-4 border-b border-neutral-800 px-6 py-2">
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
                      <Link
                        key={stage.key}
                        href={`/deals?stage=${stage.key}`}
                        className="block px-4 py-3 transition-colors hover:bg-neutral-800/60 @[30rem]:flex @[30rem]:items-center @[30rem]:gap-4 @[30rem]:px-6"
                      >
                        {/* Label + mobile trailing stats */}
                        <div className="flex items-center gap-2 @[30rem]:w-28 @[30rem]:shrink-0">
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full ${stage.dot}`}
                          />
                          <span className="text-sm text-neutral-300">
                            {stage.label}
                          </span>
                          {/* Mobile-only: show count, value, conv inline */}
                          <div className="ml-auto flex items-center gap-2 @[30rem]:hidden">
                            <span className="text-sm font-semibold text-neutral-200">
                              {stage.count}
                            </span>
                            {stage.value > 0 && (
                              <span className="text-xs text-neutral-400">
                                {fmtUSD(stage.value)}
                              </span>
                            )}
                            {conv != null && (
                              <span className={`text-xs ${convColor}`}>
                                {conv.toFixed(0)}%
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Progress bar: full-width on mobile, flex-1 on desktop */}
                        <div className="mt-1.5 @[30rem]:mt-0 @[30rem]:flex-1">
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

                        {/* Desktop-only trailing stats */}
                        <div className="hidden @[30rem]:block w-10 shrink-0 text-right text-sm font-semibold text-neutral-200">
                          {stage.count}
                        </div>
                        <div className="hidden @[30rem]:block w-28 shrink-0 text-right text-sm text-neutral-400">
                          {stage.value > 0 ? fmtUSD(stage.value) : "—"}
                        </div>
                        <div className="hidden @[30rem]:block w-24 shrink-0 text-right text-sm">
                          {conv != null ? (
                            <span className={convColor}>
                              {conv.toFixed(0)}%
                            </span>
                          ) : (
                            <span className="text-neutral-700">—</span>
                          )}
                        </div>
                      </Link>
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

          {/* Won deals per month */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-900">
            <div className="border-b border-neutral-800 px-6 py-4">
              <h3 className="text-sm font-semibold text-neutral-100">
                Deals Closed Per Month
              </h3>
              <p className="mt-0.5 text-xs text-neutral-500">
                {days
                  ? `Won deals in the last ${days} days`
                  : "Won deals over the last 6 months"}
              </p>
            </div>

            {!hasMonthData ? (
              <div className="px-6 py-12 text-center text-sm text-neutral-600">
                {days
                  ? "No won deals in this time range."
                  : "No won deals yet."}
              </div>
            ) : (
              <div className="divide-y divide-neutral-800">
                {monthBuckets.map((bucket) => (
                  <div
                    key={`${bucket.year}-${bucket.month}`}
                    className="flex items-center gap-4 px-6 py-3"
                  >
                    <div className="w-24 shrink-0 text-sm text-neutral-400">
                      {bucket.label}
                    </div>
                    <div className="flex-1">
                      <div className="h-1.5 rounded-full bg-neutral-800">
                        <div
                          className="h-1.5 rounded-full bg-green-500 opacity-60 transition-all duration-300"
                          style={{
                            width:
                              bucket.count > 0
                                ? `${(bucket.count / maxMonthCount) * 100}%`
                                : "0%",
                          }}
                        />
                      </div>
                    </div>
                    <div className="w-8 shrink-0 text-right text-sm font-semibold text-neutral-200">
                      {bucket.count}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Expected Revenue Forecast ──────────────────────────────────── */}
          <div>
            <h2 className="text-xl font-semibold text-neutral-100">
              Expected Revenue
            </h2>
            <p className="mt-1 text-sm text-neutral-400">
              Open-deal value grouped by expected close month for the next 6
              months.
            </p>
          </div>

          <div className="rounded-xl border border-neutral-800 bg-neutral-900">
            <div className="border-b border-neutral-800 px-6 py-4">
              <h3 className="text-sm font-semibold text-neutral-100">
                Pipeline Forecast
              </h3>
              <p className="mt-0.5 text-xs text-neutral-500">
                Raw and probability-weighted deal value by expected close month
              </p>
            </div>

            {!hasForecastData ? (
              <div className="px-6 py-12 text-center text-sm text-neutral-600">
                {days
                  ? `No open deals from the last ${days} days have expected close dates in the next 6 months.`
                  : "No open deals with expected close dates in the next 6 months."}
              </div>
            ) : (
              <>
                {/* Legend */}
                <div className="flex items-center gap-6 px-6 pt-4">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-4 rounded-sm bg-violet-500 opacity-80" />
                    <span className="text-xs text-neutral-400">Raw value</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-4 rounded-sm bg-blue-500 opacity-80" />
                    <span className="text-xs text-neutral-400">
                      Weighted (× probability)
                    </span>
                  </div>
                </div>

                {/* Bar chart — internal scroll so it never overflows the page */}
                <div className="overflow-x-auto">
                  <div className="flex min-w-[360px] items-end gap-2 px-6 pb-4 pt-6 sm:gap-4">
                    {forecastMonths.map((bucket) => (
                      <div
                        key={`${bucket.year}-${bucket.month}`}
                        className="flex flex-1 flex-col items-center gap-1"
                      >
                        {/* Dual bars */}
                        <div className="flex h-32 w-full items-end justify-center gap-1">
                          <div className="relative flex h-full flex-1 items-end">
                            <div
                              className="w-full rounded-t bg-violet-500 opacity-80 transition-all duration-300"
                              style={{
                                height:
                                  bucket.raw > 0
                                    ? `${(bucket.raw / maxForecastVal) * 100}%`
                                    : "2px",
                              }}
                            />
                          </div>
                          <div className="relative flex h-full flex-1 items-end">
                            <div
                              className="w-full rounded-t bg-blue-500 opacity-80 transition-all duration-300"
                              style={{
                                height:
                                  bucket.weighted > 0
                                    ? `${(bucket.weighted / maxForecastVal) * 100}%`
                                    : "2px",
                              }}
                            />
                          </div>
                        </div>

                        {/* Value labels */}
                        <div className="w-full text-center">
                          {bucket.raw > 0 ? (
                            <>
                              <p className="text-footnote truncate font-medium text-neutral-300">
                                {fmtUSD(bucket.raw)}
                              </p>
                              <p className="text-footnote truncate text-neutral-500">
                                {fmtUSD(bucket.weighted)}
                              </p>
                            </>
                          ) : (
                            <p className="text-footnote text-neutral-700">—</p>
                          )}
                        </div>

                        {/* Month label */}
                        <p className="text-footnote text-neutral-500">
                          {bucket.label}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ── Contacts analytics ─────────────────────────────────────────── */}
          <div>
            <h2 className="text-xl font-semibold text-neutral-100">Contacts</h2>
            <p className="mt-1 text-sm text-neutral-400">
              Status distribution and acquisition source breakdown.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Status distribution — @container for responsive rows */}
            <div className="@container rounded-xl border border-neutral-800 bg-neutral-900">
              <div className="border-b border-neutral-800 px-6 py-4">
                <h3 className="text-sm font-semibold text-neutral-100">
                  Status Distribution
                </h3>
                <p className="mt-0.5 text-xs text-neutral-500">
                  Contact count by lifecycle status
                </p>
              </div>

              {contacts.length === 0 ? (
                <div className="px-6 py-12 text-center text-sm text-neutral-600">
                  {days
                    ? "No contacts in this time range."
                    : "No contacts found. Add some contacts to see analytics."}
                </div>
              ) : (
                <div className="divide-y divide-neutral-800">
                  {statusRows.map((row) => (
                    <div
                      key={row.key}
                      className="block px-4 py-3 @[30rem]:flex @[30rem]:items-center @[30rem]:gap-4 @[30rem]:px-6"
                    >
                      {/* Label + mobile count */}
                      <div className="flex items-center gap-2 @[30rem]:w-24 @[30rem]:shrink-0">
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${row.dot}`}
                        />
                        <span className="text-sm text-neutral-300">
                          {row.label}
                        </span>
                        <span className="ml-auto text-sm font-semibold text-neutral-200 @[30rem]:hidden">
                          {row.count}
                        </span>
                      </div>
                      {/* Progress bar */}
                      <div className="mt-1.5 @[30rem]:mt-0 @[30rem]:flex-1">
                        <div className="h-1.5 rounded-full bg-neutral-800">
                          <div
                            className={`h-1.5 rounded-full ${row.dot} opacity-60 transition-all duration-300`}
                            style={{
                              width:
                                row.count > 0
                                  ? `${(row.count / maxStatusCount) * 100}%`
                                  : "0%",
                            }}
                          />
                        </div>
                      </div>
                      {/* Desktop count */}
                      <div className="hidden @[30rem]:block w-8 shrink-0 text-right text-sm font-semibold text-neutral-200">
                        {row.count}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Source breakdown — @container for responsive rows */}
            <div className="@container rounded-xl border border-neutral-800 bg-neutral-900">
              <div className="border-b border-neutral-800 px-6 py-4">
                <h3 className="text-sm font-semibold text-neutral-100">
                  Source Breakdown
                </h3>
                <p className="mt-0.5 text-xs text-neutral-500">
                  Contact count by acquisition source
                </p>
              </div>

              {contacts.length === 0 ? (
                <div className="px-6 py-12 text-center text-sm text-neutral-600">
                  {days
                    ? "No contacts in this time range."
                    : "No contacts found. Add some contacts to see analytics."}
                </div>
              ) : (
                <div className="divide-y divide-neutral-800">
                  {sourceRows.map((row) => (
                    <div
                      key={row.key}
                      className="block px-4 py-3 @[30rem]:flex @[30rem]:items-center @[30rem]:gap-4 @[30rem]:px-6"
                    >
                      {/* Label + mobile count */}
                      <div className="flex items-center gap-2 @[30rem]:w-28 @[30rem]:shrink-0">
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${row.dot}`}
                        />
                        <span className="text-sm text-neutral-300">
                          {row.label}
                        </span>
                        <span className="ml-auto text-sm font-semibold text-neutral-200 @[30rem]:hidden">
                          {row.count}
                        </span>
                      </div>
                      {/* Progress bar */}
                      <div className="mt-1.5 @[30rem]:mt-0 @[30rem]:flex-1">
                        <div className="h-1.5 rounded-full bg-neutral-800">
                          <div
                            className={`h-1.5 rounded-full ${row.dot} opacity-60 transition-all duration-300`}
                            style={{
                              width:
                                row.count > 0
                                  ? `${(row.count / maxSourceCount) * 100}%`
                                  : "0%",
                            }}
                          />
                        </div>
                      </div>
                      {/* Desktop count */}
                      <div className="hidden @[30rem]:block w-8 shrink-0 text-right text-sm font-semibold text-neutral-200">
                        {row.count}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
