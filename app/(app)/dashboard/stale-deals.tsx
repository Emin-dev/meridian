import { and, desc, eq, ne, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { formatCurrency } from "@/lib/format";
import Link from "next/link";

const STAGE_LABELS: Record<string, string> = {
  lead: "Lead",
  qualified: "Qualified",
  proposal: "Proposal",
  negotiation: "Negotiation",
};

const STAGE_COLORS: Record<string, string> = {
  lead: "bg-[var(--surface-2)] text-[var(--ink-2)]",
  qualified: "bg-[var(--info-tint)] text-[var(--info)]",
  proposal: "bg-[var(--accent-tint)] text-[var(--accent)]",
  negotiation: "bg-[var(--warn-tint)] text-[var(--warn)]",
};

export default async function StaleDeals() {
  const db = getDb();

  if (!db) {
    return (
      <div className="card">
        <div className="border-b border-[var(--line-1)] px-5 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--ink-3)]">
            Needs Attention
          </p>
        </div>
        <div className="flex flex-col items-center gap-2 px-5 py-8 text-center">
          <p className="text-sm text-[var(--ink-3)]">Database not connected.</p>
          <p className="text-xs text-[var(--ink-3)]">
            Set{" "}
            <code className="rounded bg-[var(--surface-2)] px-1 py-0.5">
              DATABASE_URL
            </code>{" "}
            to see stale deals.
          </p>
        </div>
      </div>
    );
  }

  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const staleDeals = await db
    .select({
      id: schema.deals.id,
      title: schema.deals.title,
      value: schema.deals.value,
      currency: schema.deals.currency,
      stage: schema.deals.stage,
    })
    .from(schema.deals)
    .leftJoin(schema.activities, eq(schema.activities.dealId, schema.deals.id))
    .where(
      and(
        ne(schema.deals.stage, "won"),
        ne(schema.deals.stage, "lost")
      )
    )
    .groupBy(
      schema.deals.id,
      schema.deals.title,
      schema.deals.value,
      schema.deals.currency,
      schema.deals.stage
    )
    .having(
      sql`max(${schema.activities.createdAt}) is null or max(${schema.activities.createdAt}) < ${fourteenDaysAgo}`
    )
    .orderBy(desc(schema.deals.value))
    .limit(10);

  return (
    <div className="card border-[var(--warn)]/40">
      <div className="flex items-center gap-2 border-b border-[var(--warn)]/40 px-5 py-3">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-4 w-4 shrink-0 text-[var(--warn)]"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z"
            clipRule="evenodd"
          />
        </svg>
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--warn)]">
          Needs Attention
        </p>
        <span className="ml-auto text-xs text-[var(--ink-3)]">
          No activity in 14+ days
        </span>
      </div>

      {staleDeals.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-[var(--ink-3)]">All deals are up to date.</p>
          <p className="mt-1 text-xs text-[var(--ink-3)]">
            No open deals have gone stale in the past 14 days.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-[var(--line-1)]">
          {staleDeals.map((deal) => {
            const stageColor =
              STAGE_COLORS[deal.stage] ?? "bg-[var(--surface-2)] text-[var(--ink-2)]";
            const stageLabel = STAGE_LABELS[deal.stage] ?? deal.stage;
            return (
              <li key={deal.id}>
                <Link
                  href={`/deals/${deal.id}`}
                  className="flex min-h-11 items-center gap-4 px-5 py-3 transition-colors hover:bg-[var(--surface-2)]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--ink-1)]">
                      {deal.title}
                    </p>
                    <span
                      className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${stageColor}`}
                    >
                      {stageLabel}
                    </span>
                  </div>
                  <div className="shrink-0 text-right">
                    {deal.value ? (
                      <p className="text-sm font-semibold text-[var(--ink-1)]">
                        {formatCurrency(parseFloat(deal.value), deal.currency)}
                      </p>
                    ) : (
                      <p className="text-sm text-[var(--ink-3)]">—</p>
                    )}
                  </div>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-4 w-4 shrink-0 text-[var(--ink-3)]"
                  >
                    <path
                      fillRule="evenodd"
                      d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                      clipRule="evenodd"
                    />
                  </svg>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
