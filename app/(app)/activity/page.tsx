import { and, desc, eq, gte } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { getDb, schema } from "@/db";
import AddActivityForm from "./add-activity-form";
import ActivityListFiltered from "./activity-list-filtered";

const VALID_TYPES = ["call", "email", "meeting", "note", "task"] as const;
type ActivityType = (typeof VALID_TYPES)[number];

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; range?: string }>;
}) {
  const { type: typeParam, range: rangeParam } = await searchParams;

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

  const db = getDb();

  const header = (
    <div>
      <h2 className="text-xl font-semibold text-neutral-100">Activity</h2>
      <p className="mt-1 text-sm text-neutral-400">
        A log of all interactions across your CRM.
      </p>
    </div>
  );

  const logCard = (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-6 py-5">
      <h3 className="mb-4 text-sm font-medium text-neutral-300">Log an activity</h3>
      <AddActivityForm />
    </div>
  );

  if (!db) {
    return (
      <div className="space-y-6">
        {header}
        {logCard}
        <div className="rounded-xl border border-neutral-800 bg-neutral-900">
          <div className="border-b border-neutral-800 px-5 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              Recent events
            </p>
          </div>
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-neutral-400">Database not connected.</p>
            <p className="mt-1 text-xs text-neutral-600">
              Set{" "}
              <code className="rounded bg-neutral-800 px-1 py-0.5">DATABASE_URL</code>{" "}
              to connect your Neon database.
            </p>
          </div>
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

  const rows = await db
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
    .limit(200);

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
      />
    </div>
  );
}
