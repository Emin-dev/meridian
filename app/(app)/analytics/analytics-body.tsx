import Link from "next/link";
import { and, eq, gte, isNotNull, notInArray, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { formatCurrency, sumByCurrency } from "@/lib/format";
import { getCrmSettings } from "@/lib/settings";
import MobileAnalyticsTiles, {
  type AnalyticsTile,
} from "./mobile-analytics-tiles";

const CONTACT_STATUSES = [
  { key: "lead" as const, label: "Lead", dot: "bg-[var(--info)]" },
  { key: "active" as const, label: "Active", dot: "bg-[var(--ok)]" },
  { key: "inactive" as const, label: "Inactive", dot: "bg-[var(--ink-3)]" },
  { key: "churned" as const, label: "Churned", dot: "bg-[var(--bad)]" },
];

const CONTACT_SOURCES = [
  { key: "website" as const, label: "Website", dot: "bg-[var(--info)]" },
  { key: "referral" as const, label: "Referral", dot: "bg-[var(--ok)]" },
  { key: "linkedin" as const, label: "LinkedIn", dot: "bg-[var(--accent)]" },
  { key: "cold-outreach" as const, label: "Cold Outreach", dot: "bg-[var(--warn)]" },
  { key: "other" as const, label: "Other", dot: "bg-[var(--ink-3)]" },
];

const STAGES = [
  { key: "lead" as const, label: "Lead", dot: "bg-[var(--info)]" },
  { key: "qualified" as const, label: "Qualified", dot: "bg-[var(--info)]" },
  { key: "proposal" as const, label: "Proposal", dot: "bg-[var(--warn)]" },
  { key: "negotiation" as const, label: "Negotiation", dot: "bg-[var(--accent)]" },
  { key: "won" as const, label: "Won", dot: "bg-[var(--ok)]" },
  { key: "lost" as const, label: "Lost", dot: "bg-[var(--bad)]" },
];

const PIPELINE_STAGES = [
  "lead",
  "qualified",
  "proposal",
  "negotiation",
  "won",
] as const;

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
    <div className="card p-3 sm:p-4 hover:border-[var(--line-1)]">
      <p className="text-caption font-medium uppercase tracking-wide text-[var(--ink-3)]">
        {label}
      </p>
      <p className="mt-2 text-title3 font-semibold text-[var(--ink-1)]">{value}</p>
      <p className="mt-1 text-footnote text-[var(--ink-3)]">{subtext}</p>
    </div>
  );
}

// ── Mobile sheet building blocks ─────────────────────────────────────────────
function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--r-lg)] bg-[var(--surface-3)] px-3 py-2.5">
      <p className="text-caption uppercase tracking-wide text-[var(--ink-3)]">
        {label}
      </p>
      <p className="mt-1 text-callout font-semibold text-[var(--ink-1)]">{value}</p>
    </div>
  );
}

function MobileBarRow({
  label,
  dot,
  count,
  max,
}: {
  label: string;
  dot: string;
  count: number;
  max: number;
}) {
  return (
    <div className="py-2.5">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
        <span className="text-callout text-[var(--ink-2)]">{label}</span>
        <span className="ml-auto text-callout font-semibold text-[var(--ink-1)]">
          {count}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-[var(--surface-3)]">
        <div
          className={`h-1.5 rounded-full ${dot} opacity-60`}
          style={{ width: count > 0 ? `${(count / max) * 100}%` : "0%" }}
        />
      </div>
    </div>
  );
}

function SheetEmpty({ children }: { children: string }) {
  return (
    <p className="py-8 text-center text-callout text-[var(--ink-3)]">{children}</p>
  );
}

export default async function AnalyticsBody({ days }: { days: string }) {
  const since: Date | null = days
    ? new Date(Date.now() - parseInt(days, 10) * 24 * 60 * 60 * 1000)
    : null;

  const db = getDb();
  // Deals can be in mixed currencies, so a single SQL sum() would blend them
  // into a dishonest number. We pick the dominant currency (the one holding the
  // most total deal value) below and label every money aggregate in it, scoping
  // value figures to that currency. getCrmSettings falls back to defaults — and
  // the empty DB case — gracefully, providing the fallback currency.
  const { defaultCurrency } = await getCrmSettings();
  const dealWhere = since ? gte(schema.deals.createdAt, since) : undefined;
  const contactWhere = since ? gte(schema.contacts.createdAt, since) : undefined;

  // ── Stage funnel + summary aggregates (one GROUP BY over deals) ───────────────
  // count(value) is the non-null value count, used for the avg-won-deal figure.
  const stageAgg = db
    ? await db
        .select({
          stage: schema.deals.stage,
          currency: schema.deals.currency,
          count: sql<number>`count(*)::int`,
          value: sql<number>`coalesce(sum(${schema.deals.value}), 0)::float8`,
          valueCount: sql<number>`count(${schema.deals.value})::int`,
        })
        .from(schema.deals)
        .where(dealWhere)
        .groupBy(schema.deals.stage, schema.deals.currency)
    : [];

  // ── Avg days to close (createdAt → updatedAt) for won deals ───────────────────
  const closeAgg = db
    ? await db
        .select({
          avgDays: sql<
            number | null
          >`avg(extract(epoch from (${schema.deals.updatedAt} - ${schema.deals.createdAt})) / 86400.0)::float8`,
        })
        .from(schema.deals)
        .where(and(eq(schema.deals.stage, "won"), dealWhere))
    : [];

  // ── Pipeline forecast: open-deal value by expected-close month ────────────────
  const forecastAgg = db
    ? await db
        .select({
          year: sql<number>`extract(year from ${schema.deals.expectedCloseDate})::int`,
          month: sql<number>`extract(month from ${schema.deals.expectedCloseDate})::int - 1`,
          currency: schema.deals.currency,
          count: sql<number>`count(*)::int`,
          raw: sql<number>`coalesce(sum(${schema.deals.value}), 0)::float8`,
          weighted: sql<number>`coalesce(sum(${schema.deals.value} * ${schema.deals.probability} / 100.0), 0)::float8`,
        })
        .from(schema.deals)
        .where(
          and(
            dealWhere,
            notInArray(schema.deals.stage, ["won", "lost"]),
            isNotNull(schema.deals.value),
            isNotNull(schema.deals.expectedCloseDate)
          )
        )
        .groupBy(
          sql`extract(year from ${schema.deals.expectedCloseDate})::int`,
          sql`extract(month from ${schema.deals.expectedCloseDate})::int - 1`,
          schema.deals.currency
        )
    : [];

  // ── Won deals per month (by updatedAt) ────────────────────────────────────────
  const wonMonthAgg = db
    ? await db
        .select({
          year: sql<number>`extract(year from ${schema.deals.updatedAt})::int`,
          month: sql<number>`extract(month from ${schema.deals.updatedAt})::int - 1`,
          count: sql<number>`count(*)::int`,
        })
        .from(schema.deals)
        .where(
          and(
            eq(schema.deals.stage, "won"),
            dealWhere,
            since ? gte(schema.deals.updatedAt, since) : undefined
          )
        )
        .groupBy(
          sql`extract(year from ${schema.deals.updatedAt})::int`,
          sql`extract(month from ${schema.deals.updatedAt})::int - 1`
        )
    : [];

  // ── Contact status distribution ───────────────────────────────────────────────
  const statusAgg = db
    ? await db
        .select({
          status: schema.contacts.status,
          count: sql<number>`count(*)::int`,
        })
        .from(schema.contacts)
        .where(contactWhere)
        .groupBy(schema.contacts.status)
    : [];

  // ── Contact source breakdown ──────────────────────────────────────────────────
  const sourceAgg = db
    ? await db
        .select({
          source: schema.contacts.source,
          count: sql<number>`count(*)::int`,
        })
        .from(schema.contacts)
        .where(contactWhere)
        .groupBy(schema.contacts.source)
    : [];

  // ── Dominant currency ─────────────────────────────────────────────────────────
  // Pick the currency holding the most total deal value; all money aggregates
  // are labelled in it and value sums are scoped to it, so mixed currencies are
  // never blended under one symbol. Falls back to the configured default when
  // there are no valued deals.
  const valueByCurrency = sumByCurrency(
    stageAgg.map((r) => ({ value: r.value, currency: r.currency }))
  );
  const dominantCurrency =
    Object.entries(valueByCurrency).sort((a, b) => b[1] - a[1])[0]?.[0] ??
    defaultCurrency;
  const otherCurrencyCount = Math.max(
    Object.keys(valueByCurrency).length - 1,
    0
  );
  const mixedCurrencyNote =
    otherCurrencyCount > 0
      ? `Money totals shown in ${dominantCurrency}; deals in ${otherCurrencyCount} other currenc${
          otherCurrencyCount === 1 ? "y are" : "ies are"
        } excluded.`
      : null;
  const fmtMoney = (value: number) => formatCurrency(value, dominantCurrency);

  // ── Derive per-stage maps + total ─────────────────────────────────────────────
  // Counts span every currency (a deal is a deal regardless of currency), but
  // value sums are scoped to the dominant currency so totals stay honest.
  const stageCount: Record<string, number> = {};
  const stageValue: Record<string, number> = {};
  const stageValueCount: Record<string, number> = {};
  let totalDeals = 0;
  for (const r of stageAgg) {
    totalDeals += r.count;
    if (!r.stage) continue;
    stageCount[r.stage] = (stageCount[r.stage] ?? 0) + r.count;
    if (r.currency === dominantCurrency) {
      stageValue[r.stage] = (stageValue[r.stage] ?? 0) + r.value;
      stageValueCount[r.stage] = (stageValueCount[r.stage] ?? 0) + r.valueCount;
    }
  }

  // ── Summary stats ────────────────────────────────────────────────────────────
  const wonCount = stageCount["won"] ?? 0;
  const lostCount = stageCount["lost"] ?? 0;
  const closedCount = wonCount + lostCount;
  const winRate = closedCount > 0 ? (wonCount / closedCount) * 100 : null;

  const wonWithValueCount = stageValueCount["won"] ?? 0;
  const avgWonValue =
    wonWithValueCount > 0 ? (stageValue["won"] ?? 0) / wonWithValueCount : null;

  const ACTIVE_STAGES = ["lead", "qualified", "proposal", "negotiation"] as const;
  const totalPipeline = ACTIVE_STAGES.reduce(
    (sum, k) => sum + (stageValue[k] ?? 0),
    0
  );
  const activeDealsCount = ACTIVE_STAGES.reduce(
    (sum, k) => sum + (stageCount[k] ?? 0),
    0
  );

  const avgDaysToClose =
    closeAgg[0]?.avgDays != null ? Number(closeAgg[0].avgDays) : null;

  const now = new Date();

  // ── Pipeline forecast (next 6 months by expectedCloseDate) ─────────────────
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
  for (const row of forecastAgg) {
    // Scope the forecast to the dominant currency so raw/weighted bars aren't a
    // blend of incompatible currencies.
    if (row.currency !== dominantCurrency) continue;
    const bucket = forecastMonths.find(
      (b) => b.year === row.year && b.month === row.month
    );
    if (!bucket) continue;
    bucket.raw += row.raw;
    bucket.weighted += row.weighted;
  }
  const maxForecastVal = Math.max(...forecastMonths.map((b) => b.raw), 1);
  const hasForecastData = forecastMonths.some((b) => b.raw > 0);

  // Forecast bars are scoped to the dominant currency (see loop above), which
  // silently drops open deals priced in other currencies. Count those dropped
  // deals — but only ones whose close date lands in the displayed 6-month window
  // — so the note reflects exactly what's missing from the chart, not all deals.
  let forecastExcludedDeals = 0;
  const forecastExcludedCurrencies = new Set<string>();
  for (const row of forecastAgg) {
    if (row.currency === dominantCurrency) continue;
    const inWindow = forecastMonths.some(
      (b) => b.year === row.year && b.month === row.month
    );
    if (!inWindow) continue;
    forecastExcludedDeals += row.count;
    if (row.currency) forecastExcludedCurrencies.add(row.currency);
  }
  const forecastCurrencyNote =
    forecastExcludedDeals > 0
      ? `+${forecastExcludedDeals} deal${
          forecastExcludedDeals !== 1 ? "s" : ""
        } in ${forecastExcludedCurrencies.size} other currenc${
          forecastExcludedCurrencies.size === 1 ? "y" : "ies"
        } excluded from this forecast.`
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
  let wonForChartTotal = 0;
  for (const row of wonMonthAgg) {
    wonForChartTotal += row.count;
    const bucket = monthBuckets.find(
      (b) => b.year === row.year && b.month === row.month
    );
    if (bucket) bucket.count += row.count;
  }
  const maxMonthCount = Math.max(...monthBuckets.map((b) => b.count), 1);
  const hasMonthData = wonForChartTotal > 0;

  // ── Stage funnel ─────────────────────────────────────────────────────────────
  const stageRows = STAGES.map((stage) => ({
    ...stage,
    count: stageCount[stage.key] ?? 0,
    value: stageValue[stage.key] ?? 0,
  }));

  const maxCount = Math.max(...stageRows.map((s) => s.count), 1);

  // ── Contacts analytics ───────────────────────────────────────────────────────
  const statusCountMap: Record<string, number> = {};
  let totalContacts = 0;
  for (const r of statusAgg) {
    totalContacts += r.count;
    if (r.status) statusCountMap[r.status] = r.count;
  }
  const statusRows = CONTACT_STATUSES.map((s) => ({
    ...s,
    count: statusCountMap[s.key] ?? 0,
  }));
  const maxStatusCount = Math.max(...statusRows.map((s) => s.count), 1);

  const sourceCountMap: Record<string, number> = {};
  for (const r of sourceAgg) {
    if (r.source) sourceCountMap[r.source] = r.count;
  }
  const sourceRows = CONTACT_SOURCES.map((s) => ({
    ...s,
    count: sourceCountMap[s.key] ?? 0,
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

  // ── Mobile summary tiles (one per section) ───────────────────────────────────
  const forecastTotalRaw = forecastMonths.reduce((s, b) => s + b.raw, 0);

  const mobileTiles: AnalyticsTile[] = [
    {
      key: "conversion",
      label: "Win Rate",
      value: winRate !== null ? `${winRate.toFixed(1)}%` : "—",
      subtext:
        closedCount > 0 ? `${wonCount}/${closedCount} closed` : "No closed deals",
      sheetTitle: "Conversion & Performance",
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2.5">
            <MiniStat
              label="Win Rate"
              value={winRate !== null ? `${winRate.toFixed(1)}%` : "—"}
            />
            <MiniStat
              label="Avg Won Deal"
              value={avgWonValue !== null ? fmtMoney(avgWonValue) : "—"}
            />
            <MiniStat label="Pipeline Value" value={fmtMoney(totalPipeline)} />
            <MiniStat
              label="Avg Days to Close"
              value={
                avgDaysToClose !== null ? `${Math.round(avgDaysToClose)}d` : "—"
              }
            />
          </div>
          <p className="text-footnote text-[var(--ink-3)]">
            {closedCount > 0
              ? `${wonCount} won of ${closedCount} closed deals · ${activeDealsCount} still active.`
              : days
                ? "No closed deals in this range yet."
                : "No closed deals yet."}
          </p>
        </div>
      ),
    },
    {
      key: "funnel",
      label: "Pipeline",
      value: fmtMoney(totalPipeline),
      subtext: `${activeDealsCount} active deal${activeDealsCount !== 1 ? "s" : ""}`,
      sheetTitle: "Stage Funnel",
      content:
        totalDeals === 0 ? (
          <SheetEmpty>
            {days ? "No deals in this time range." : "No deals found."}
          </SheetEmpty>
        ) : (
          <div className="divide-y divide-[var(--line-1)]">
            {stageRows.map((stage) => {
              const conv = conversionRate[stage.key];
              const convColor =
                conv == null
                  ? ""
                  : conv >= 50
                    ? "text-[var(--ok)]"
                    : conv >= 25
                      ? "text-[var(--warn)]"
                      : "text-[var(--bad)]";
              return (
                <div key={stage.key} className="py-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${stage.dot}`}
                    />
                    <span className="text-callout text-[var(--ink-2)]">
                      {stage.label}
                    </span>
                    <span className="ml-auto text-callout font-semibold text-[var(--ink-1)]">
                      {stage.count}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-[var(--surface-3)]">
                    <div
                      className={`h-1.5 rounded-full ${stage.dot} opacity-60`}
                      style={{
                        width:
                          stage.count > 0
                            ? `${(stage.count / maxCount) * 100}%`
                            : "0%",
                      }}
                    />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-footnote">
                    <span className="text-[var(--ink-2)]">
                      {stage.value > 0 ? fmtMoney(stage.value) : "—"}
                    </span>
                    {conv != null && (
                      <span className={convColor}>{conv.toFixed(0)}% conv.</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ),
    },
    {
      key: "sources",
      label: "Contacts",
      value: totalContacts.toString(),
      subtext: "Status & sources",
      sheetTitle: "Contacts",
      content:
        totalContacts === 0 ? (
          <SheetEmpty>
            {days ? "No contacts in this time range." : "No contacts found."}
          </SheetEmpty>
        ) : (
          <div className="space-y-5">
            <div>
              <p className="mb-1 text-caption uppercase tracking-wide text-[var(--ink-3)]">
                Status distribution
              </p>
              <div className="divide-y divide-[var(--line-1)]">
                {statusRows.map((row) => (
                  <MobileBarRow
                    key={row.key}
                    label={row.label}
                    dot={row.dot}
                    count={row.count}
                    max={maxStatusCount}
                  />
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1 text-caption uppercase tracking-wide text-[var(--ink-3)]">
                Source breakdown
              </p>
              <div className="divide-y divide-[var(--line-1)]">
                {sourceRows.map((row) => (
                  <MobileBarRow
                    key={row.key}
                    label={row.label}
                    dot={row.dot}
                    count={row.count}
                    max={maxSourceCount}
                  />
                ))}
              </div>
            </div>
          </div>
        ),
    },
    {
      key: "forecast",
      label: "Forecast",
      value: fmtMoney(forecastTotalRaw),
      subtext: "Next 6 months",
      sheetTitle: "Revenue Forecast",
      content: (
        <div className="space-y-5">
          <div>
            <p className="mb-1 text-caption uppercase tracking-wide text-[var(--ink-3)]">
              Expected revenue (next 6 mo)
            </p>
            {!hasForecastData ? (
              <SheetEmpty>No open deals with expected close dates.</SheetEmpty>
            ) : (
              <div className="divide-y divide-[var(--line-1)]">
                {forecastMonths.map((b) => (
                  <div key={`${b.year}-${b.month}`} className="py-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-callout text-[var(--ink-2)]">
                        {b.label}
                      </span>
                      <span className="text-callout font-semibold text-[var(--ink-1)]">
                        {b.raw > 0 ? fmtMoney(b.raw) : "—"}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-[var(--surface-3)]">
                      <div
                        className="h-1.5 rounded-full bg-[var(--accent)] opacity-70"
                        style={{
                          width:
                            b.raw > 0
                              ? `${(b.raw / maxForecastVal) * 100}%`
                              : "0%",
                        }}
                      />
                    </div>
                    {b.weighted > 0 && (
                      <p className="mt-1 text-footnote text-[var(--ink-3)]">
                        Weighted {fmtMoney(b.weighted)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
            {forecastCurrencyNote && (
              <p className="mt-2 text-footnote text-[var(--ink-3)]">
                {forecastCurrencyNote}
              </p>
            )}
          </div>
          <div>
            <p className="mb-1 text-caption uppercase tracking-wide text-[var(--ink-3)]">
              Deals closed per month
            </p>
            {!hasMonthData ? (
              <SheetEmpty>No won deals yet.</SheetEmpty>
            ) : (
              <div className="divide-y divide-[var(--line-1)]">
                {monthBuckets.map((bucket) => (
                  <div
                    key={`${bucket.year}-${bucket.month}`}
                    className="py-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-callout text-[var(--ink-2)]">
                        {bucket.label}
                      </span>
                      <span className="text-callout font-semibold text-[var(--ink-1)]">
                        {bucket.count}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-[var(--surface-3)]">
                      <div
                        className="h-1.5 rounded-full bg-[var(--ok)] opacity-60"
                        style={{
                          width:
                            bucket.count > 0
                              ? `${(bucket.count / maxMonthCount) * 100}%`
                              : "0%",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ),
    },
  ];

  return (
    <>
      {/* No DB state */}
      {!db && (
        <div className="flex flex-col items-center gap-3 card px-5 py-16 text-center">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-[var(--ink-3)]"
          >
            <line x1="18" x2="18" y1="20" y2="10" />
            <line x1="12" x2="12" y1="20" y2="4" />
            <line x1="6" x2="6" y1="20" y2="14" />
          </svg>
          <p className="text-callout text-[var(--ink-2)]">Database not connected.</p>
          <p className="text-footnote text-[var(--ink-3)]">
            Set DATABASE_URL to connect your Neon database.
          </p>
        </div>
      )}

      {db && (
        <>
          {/* Mobile (<lg): calm summary tiles that tap-expand into sheets */}
          <div className="lg:hidden">
            <MobileAnalyticsTiles tiles={mobileTiles} />
          </div>

          {/* Desktop (lg+): full charts and tables — layout unchanged */}
          <div className="hidden space-y-8 lg:block">
          {/* Summary stat cards — container query: 1→2→4 cols */}
          <div className="@container">
            <div className="grid grid-cols-1 gap-4 @sm:grid-cols-2 @xl:grid-cols-4">
              <StatCard
                label="Win Rate"
                value={winRate !== null ? `${winRate.toFixed(1)}%` : "—"}
                subtext={
                  closedCount > 0
                    ? `${wonCount} won of ${closedCount} closed`
                    : days
                      ? "No closed deals in this range"
                      : "No closed deals yet"
                }
              />
              <StatCard
                label="Avg Won Deal Value"
                value={avgWonValue !== null ? fmtMoney(avgWonValue) : "—"}
                subtext={
                  wonWithValueCount > 0
                    ? `across ${wonWithValueCount} won deal${wonWithValueCount !== 1 ? "s" : ""}`
                    : days
                      ? "No won deals in this range"
                      : "No won deals with value"
                }
              />
              <StatCard
                label="Total Pipeline Value"
                value={fmtMoney(totalPipeline)}
                subtext={`${activeDealsCount} active deal${activeDealsCount !== 1 ? "s" : ""}`}
              />
              <StatCard
                label="Avg Days to Close"
                value={
                  avgDaysToClose !== null ? `${Math.round(avgDaysToClose)}d` : "—"
                }
                subtext={
                  wonCount > 0
                    ? `across ${wonCount} won deal${wonCount !== 1 ? "s" : ""}`
                    : days
                      ? "No won deals in this range"
                      : "No won deals yet"
                }
              />
            </div>
            {mixedCurrencyNote && (
              <p className="mt-3 text-footnote text-[var(--ink-3)]">
                {mixedCurrencyNote}
              </p>
            )}
          </div>

          {/* Stage funnel — @container for responsive rows */}
          <div className="@container card">
            <div className="border-b border-[var(--line-1)] px-5 py-3">
              <h3 className="text-callout font-semibold text-[var(--ink-1)]">
                Stage Funnel
              </h3>
              <p className="mt-0.5 text-footnote text-[var(--ink-3)]">
                Deal count, total value, and forward conversion rate per stage
              </p>
            </div>

            {totalDeals === 0 ? (
              <div className="px-6 py-12 text-center text-callout text-[var(--ink-3)]">
                {days
                  ? "No deals in this time range."
                  : "No deals found. Add some deals to see analytics."}
              </div>
            ) : (
              <>
                {/* Column headers: only on wide containers */}
                <div className="hidden @[30rem]:flex items-center gap-4 border-b border-[var(--line-1)] px-6 py-2">
                  <div className="w-28 shrink-0 text-footnote font-medium uppercase tracking-wide text-[var(--ink-3)]">
                    Stage
                  </div>
                  <div className="flex-1" />
                  <div className="w-10 shrink-0 text-right text-footnote font-medium uppercase tracking-wide text-[var(--ink-3)]">
                    Deals
                  </div>
                  <div className="w-28 shrink-0 text-right text-footnote font-medium uppercase tracking-wide text-[var(--ink-3)]">
                    Value
                  </div>
                  <div className="w-24 shrink-0 text-right text-footnote font-medium uppercase tracking-wide text-[var(--ink-3)]">
                    Conv. Rate
                  </div>
                </div>

                <div className="divide-y divide-[var(--line-1)]">
                  {stageRows.map((stage) => {
                    const conv = conversionRate[stage.key];
                    const convColor =
                      conv == null
                        ? ""
                        : conv >= 50
                          ? "text-[var(--ok)]"
                          : conv >= 25
                            ? "text-[var(--warn)]"
                            : "text-[var(--bad)]";
                    const isZero = stage.count === 0;
                    const rowClass = `block px-4 py-3 @[30rem]:flex @[30rem]:items-center @[30rem]:gap-4 @[30rem]:px-6${
                      isZero
                        ? ""
                        : " transition-colors hover:bg-[var(--surface-2)]"
                    }`;
                    const rowInner = (
                      <>
                        {/* Label + mobile trailing stats */}
                        <div className="flex items-center gap-2 @[30rem]:w-28 @[30rem]:shrink-0">
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full ${stage.dot}`}
                          />
                          <span className="text-callout text-[var(--ink-2)]">
                            {stage.label}
                          </span>
                          {/* Mobile-only: show count, value, conv inline */}
                          <div className="ml-auto flex items-center gap-2 @[30rem]:hidden">
                            <span className="text-callout font-semibold text-[var(--ink-1)]">
                              {stage.count}
                            </span>
                            {stage.value > 0 && (
                              <span className="text-footnote text-[var(--ink-2)]">
                                {fmtMoney(stage.value)}
                              </span>
                            )}
                            {conv != null && (
                              <span className={`text-footnote ${convColor}`}>
                                {conv.toFixed(0)}%
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Progress bar: full-width on mobile, flex-1 on desktop.
                            Zero-count stages render no track so the row reads as a
                            deliberate empty state, not a broken/skeleton bar. */}
                        <div className="mt-1.5 @[30rem]:mt-0 @[30rem]:flex-1">
                          {!isZero && (
                            <div className="h-1.5 rounded-full bg-[var(--surface-3)]">
                              <div
                                className={`h-1.5 rounded-full ${stage.dot} opacity-60 transition-all duration-300`}
                                style={{
                                  width: `${(stage.count / maxCount) * 100}%`,
                                }}
                              />
                            </div>
                          )}
                        </div>

                        {/* Desktop-only trailing stats */}
                        <div className="hidden @[30rem]:block w-10 shrink-0 text-right text-callout font-semibold text-[var(--ink-1)]">
                          {stage.count}
                        </div>
                        <div className="hidden @[30rem]:block w-28 shrink-0 text-right text-callout text-[var(--ink-2)]">
                          {stage.value > 0 ? fmtMoney(stage.value) : "—"}
                        </div>
                        <div className="hidden @[30rem]:block w-24 shrink-0 text-right text-callout">
                          {conv != null ? (
                            <span className={convColor}>
                              {conv.toFixed(0)}%
                            </span>
                          ) : (
                            <span className="text-[var(--ink-3)]">—</span>
                          )}
                        </div>
                      </>
                    );
                    return isZero ? (
                      <div key={stage.key} className={rowClass}>
                        {rowInner}
                      </div>
                    ) : (
                      <Link
                        key={stage.key}
                        href={`/deals?stage=${stage.key}`}
                        className={rowClass}
                      >
                        {rowInner}
                      </Link>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="border-t border-[var(--line-1)] px-6 py-3">
                  <p className="text-footnote text-[var(--ink-3)]">
                    Conv. Rate = deals in this stage ÷ deals in the previous
                    stage. Lead and Lost stages have no forward conversion.
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Won deals per month */}
          <div className="card">
            <div className="border-b border-[var(--line-1)] px-5 py-3">
              <h3 className="text-callout font-semibold text-[var(--ink-1)]">
                Deals Closed Per Month
              </h3>
              <p className="mt-0.5 text-footnote text-[var(--ink-3)]">
                {days
                  ? `Won deals in the last ${days} days`
                  : "Won deals over the last 6 months"}
              </p>
            </div>

            {!hasMonthData ? (
              <div className="px-6 py-12 text-center text-callout text-[var(--ink-3)]">
                {days
                  ? "No won deals in this time range."
                  : "No won deals yet."}
              </div>
            ) : (
              <div className="divide-y divide-[var(--line-1)]">
                {monthBuckets.map((bucket) => (
                  <div
                    key={`${bucket.year}-${bucket.month}`}
                    className="flex items-center gap-4 px-6 py-3"
                  >
                    <div className="w-24 shrink-0 text-callout text-[var(--ink-2)]">
                      {bucket.label}
                    </div>
                    <div className="flex-1">
                      <div className="h-1.5 rounded-full bg-[var(--surface-3)]">
                        <div
                          className="h-1.5 rounded-full bg-[var(--ok)] opacity-60 transition-all duration-300"
                          style={{
                            width:
                              bucket.count > 0
                                ? `${(bucket.count / maxMonthCount) * 100}%`
                                : "0%",
                          }}
                        />
                      </div>
                    </div>
                    <div className="w-8 shrink-0 text-right text-callout font-semibold text-[var(--ink-1)]">
                      {bucket.count}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Expected Revenue Forecast ──────────────────────────────────── */}
          <div>
            <h2 className="text-title3 font-semibold text-[var(--ink-1)]">
              Expected Revenue
            </h2>
            <p className="mt-1 text-callout text-[var(--ink-2)]">
              Open-deal value grouped by expected close month for the next 6
              months.
            </p>
          </div>

          <div className="card">
            <div className="border-b border-[var(--line-1)] px-5 py-3">
              <h3 className="text-callout font-semibold text-[var(--ink-1)]">
                Pipeline Forecast
              </h3>
              <p className="mt-0.5 text-footnote text-[var(--ink-3)]">
                Raw and probability-weighted deal value by expected close month
              </p>
            </div>

            {!hasForecastData ? (
              <div className="px-6 py-12 text-center text-callout text-[var(--ink-3)]">
                {days
                  ? `No open deals from the last ${days} days have expected close dates in the next 6 months.`
                  : "No open deals with expected close dates in the next 6 months."}
              </div>
            ) : (
              <>
                {/* Legend */}
                <div className="flex items-center gap-6 px-6 pt-4">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-4 rounded-sm bg-[var(--accent)] opacity-80" />
                    <span className="text-footnote text-[var(--ink-2)]">Raw value</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-4 rounded-sm bg-[var(--info)] opacity-80" />
                    <span className="text-footnote text-[var(--ink-2)]">
                      Weighted (× probability)
                    </span>
                  </div>
                </div>

                {/* Bar chart — fluid columns so it never overflows narrow phones */}
                <div>
                  <div className="flex items-end gap-1.5 px-4 pb-4 pt-6 sm:gap-4 sm:px-6">
                    {forecastMonths.map((bucket) => (
                      <div
                        key={`${bucket.year}-${bucket.month}`}
                        className="flex min-w-0 flex-1 flex-col items-center gap-1"
                      >
                        {/* Dual bars */}
                        <div className="flex h-32 w-full items-end justify-center gap-1">
                          <div className="relative flex h-full flex-1 items-end">
                            <div
                              className="w-full rounded-t bg-[var(--accent)] opacity-80 transition-all duration-300"
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
                              className="w-full rounded-t bg-[var(--info)] opacity-80 transition-all duration-300"
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
                              <p className="text-footnote truncate font-medium text-[var(--ink-2)]">
                                {fmtMoney(bucket.raw)}
                              </p>
                              <p className="text-footnote truncate text-[var(--ink-3)]">
                                {fmtMoney(bucket.weighted)}
                              </p>
                            </>
                          ) : (
                            <p className="text-footnote text-[var(--ink-3)]">—</p>
                          )}
                        </div>

                        {/* Month label */}
                        <p className="text-footnote max-w-full truncate text-[var(--ink-3)]">
                          {bucket.label}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {forecastCurrencyNote && (
              <div className="border-t border-[var(--line-1)] px-6 py-3">
                <p className="text-footnote text-[var(--ink-3)]">
                  {forecastCurrencyNote}
                </p>
              </div>
            )}
          </div>

          {/* ── Contacts analytics ─────────────────────────────────────────── */}
          <div>
            <h2 className="text-title3 font-semibold text-[var(--ink-1)]">Contacts</h2>
            <p className="mt-1 text-callout text-[var(--ink-2)]">
              Status distribution and acquisition source breakdown.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Status distribution — @container for responsive rows */}
            <div className="@container card">
              <div className="border-b border-[var(--line-1)] px-5 py-3">
                <h3 className="text-callout font-semibold text-[var(--ink-1)]">
                  Status Distribution
                </h3>
                <p className="mt-0.5 text-footnote text-[var(--ink-3)]">
                  Contact count by lifecycle status
                </p>
              </div>

              {totalContacts === 0 ? (
                <div className="px-6 py-12 text-center text-callout text-[var(--ink-3)]">
                  {days
                    ? "No contacts in this time range."
                    : "No contacts found. Add some contacts to see analytics."}
                </div>
              ) : (
                <div className="divide-y divide-[var(--line-1)]">
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
                        <span className="text-callout text-[var(--ink-2)]">
                          {row.label}
                        </span>
                        <span className="ml-auto text-callout font-semibold text-[var(--ink-1)] @[30rem]:hidden">
                          {row.count}
                        </span>
                      </div>
                      {/* Progress bar */}
                      <div className="mt-1.5 @[30rem]:mt-0 @[30rem]:flex-1">
                        <div className="h-1.5 rounded-full bg-[var(--surface-3)]">
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
                      <div className="hidden @[30rem]:block w-8 shrink-0 text-right text-callout font-semibold text-[var(--ink-1)]">
                        {row.count}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Source breakdown — @container for responsive rows */}
            <div className="@container card">
              <div className="border-b border-[var(--line-1)] px-5 py-3">
                <h3 className="text-callout font-semibold text-[var(--ink-1)]">
                  Source Breakdown
                </h3>
                <p className="mt-0.5 text-footnote text-[var(--ink-3)]">
                  Contact count by acquisition source
                </p>
              </div>

              {totalContacts === 0 ? (
                <div className="px-6 py-12 text-center text-callout text-[var(--ink-3)]">
                  {days
                    ? "No contacts in this time range."
                    : "No contacts found. Add some contacts to see analytics."}
                </div>
              ) : (
                <div className="divide-y divide-[var(--line-1)]">
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
                        <span className="text-callout text-[var(--ink-2)]">
                          {row.label}
                        </span>
                        <span className="ml-auto text-callout font-semibold text-[var(--ink-1)] @[30rem]:hidden">
                          {row.count}
                        </span>
                      </div>
                      {/* Progress bar */}
                      <div className="mt-1.5 @[30rem]:mt-0 @[30rem]:flex-1">
                        <div className="h-1.5 rounded-full bg-[var(--surface-3)]">
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
                      <div className="hidden @[30rem]:block w-8 shrink-0 text-right text-callout font-semibold text-[var(--ink-1)]">
                        {row.count}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          </div>
        </>
      )}
    </>
  );
}
