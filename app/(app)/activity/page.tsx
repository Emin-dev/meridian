import { and, count, desc, eq, gte } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { getDb, schema } from "@/db";
import AddActivityForm from "./add-activity-form";
import ActivityListFiltered from "./activity-list-filtered";
import { EmptyState } from "@/components/empty-state";

const LightningIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const VALID_TYPES = ["call", "email", "meeting", "note", "task"] as const;
type ActivityType = (typeof VALID_TYPES)[number];

const PAGE_SIZE = 50;

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; range?: string; offset?: string }>;
}) {
  const { type: typeParam, range: rangeParam, offset: offsetParam } = await searchParams;

  const typeFilter =
    typeParam && (VALID_TYPES as readonly string[]).includes(typeParam)
      ? (typeParam as ActivityType)
      : undefined;

  const rangeFilter =
    rangeParam && ["7", "30", "90"].includes(rangeParam)
      ? parseInt(rangeParam, 10)
      : undefined;

  const currentType = typeFilter ?? "";
  const currentRange = rangeFilter !== undefined ? String(rangeFilter) : "";

  const offset =
    offsetParam && /^\d+$/.test(offsetParam)
      ? Math.max(0, parseInt(offsetParam, 10))
      : 0;
  const limit = PAGE_SIZE + offset;

  const db = getDb();

  const header = (
    <div>
      <h2 className="text-title2 font-semibold text-[--ink-1]">Activity</h2>
      <p className="mt-1 text-body text-[--ink-2]">
        A log of all interactions across your CRM.
      </p>
    </div>
  );

  const logCard = (
    <div className="card px-4 py-5 sm:px-6">
      <h3 className="mb-4 text-callout font-medium text-[--ink-1]">Log an activity</h3>
      <AddActivityForm />
    </div>
  );

  if (!db) {
    return (
      <div className="space-y-6">
        {header}
        {logCard}
        <div className="card">
          <div className="border-b border-[--line-1] px-4 py-3 sm:px-5">
            <p className="text-caption font-medium uppercase tracking-wide text-[--ink-3]">
              Recent events
            </p>
          </div>
          <EmptyState
            icon={<LightningIcon />}
            title="Database not connected"
            description="Set DATABASE_URL to connect your Neon database."
          />
        </div>
      </div>
    );
  }

  const cutoff =
    rangeFilter !== undefined
      ? new Date(Date.now() - rangeFilter * 24 * 60 * 60 * 1000)
      : undefined;

  const conditions: (SQL | undefined)[] = [
    typeFilter ? eq(schema.activities.type, typeFilter) : undefined,
    cutoff ? gte(schema.activities.createdAt, cutoff) : undefined,
  ];
  const whereClause = and(...conditions);

  const [countResult, rows] = await Promise.all([
    db.select({ total: count() }).from(schema.activities).where(whereClause),
    db
      .select({
        activity: schema.activities,
        contactName: schema.contacts.name,
        dealTitle: schema.deals.title,
      })
      .from(schema.activities)
      .leftJoin(
        schema.contacts,
        eq(schema.activities.contactId, schema.contacts.id)
      )
      .leftJoin(schema.deals, eq(schema.activities.dealId, schema.deals.id))
      .where(whereClause)
      .orderBy(desc(schema.activities.createdAt))
      .limit(limit),
  ]);

  const total = Number(countResult[0]?.total ?? 0);

  const serialized = rows.map(({ activity, contactName, dealTitle }) => ({
    activity: {
      id: activity.id,
      type: activity.type,
      subject: activity.subject,
      body: activity.body ?? null,
      createdAt: activity.createdAt.toISOString(),
      dueAt: activity.dueAt ? activity.dueAt.toISOString() : null,
      completedAt: activity.completedAt ? activity.completedAt.toISOString() : null,
      contactId: activity.contactId ?? null,
      dealId: activity.dealId ?? null,
    },
    contactName: contactName ?? null,
    dealTitle: dealTitle ?? null,
  }));

  return (
    <div className="space-y-6">
      {header}
      {logCard}
      <ActivityListFiltered
        rows={serialized}
        currentType={currentType}
        currentRange={currentRange}
        total={total}
      />
    </div>
  );
}
