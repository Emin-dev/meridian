import { desc, eq, gte, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import AiDigest from "@/components/ai-digest";
import PipelineChart from "@/components/pipeline-chart-wrapper";

const STAGES = [
  "lead",
  "qualified",
  "proposal",
  "negotiation",
  "won",
  "lost",
] as const;

type Stage = (typeof STAGES)[number];

const TYPE_META: Record<string, { label: string; color: string; bg: string }> =
  {
    call: { label: "Call", color: "text-blue-400", bg: "bg-blue-900/30" },
    email: {
      label: "Email",
      color: "text-purple-400",
      bg: "bg-purple-900/30",
    },
    meeting: {
      label: "Meeting",
      color: "text-green-400",
      bg: "bg-green-900/30",
    },
    note: { label: "Note", color: "text-amber-400", bg: "bg-amber-900/30" },
    task: { label: "Task", color: "text-indigo-400", bg: "bg-indigo-900/30" },
  };

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function KpiCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-neutral-100">{value}</p>
    </div>
  );
}

export default async function DashboardPage() {
  const db = getDb();

  let totalContacts = 0;
  let openDealsCount = 0;
  let pipelineValue = 0;
  let weekActivityCount = 0;
  let recentActivities: Array<{
    id: number;
    type: string;
    subject: string;
    createdAt: Date;
    contactName: string | null;
    dealTitle: string | null;
  }> = [];
  let dealsByStage: { stage: string; count: number; value: number }[] =
    STAGES.map((s) => ({ stage: s, count: 0, value: 0 }));

  if (db) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [contactRows, allDeals, activityRows, weekRows] = await Promise.all([
      db
        .select({ value: sql<number>`count(*)` })
        .from(schema.contacts),
      db.query.deals.findMany(),
      db
        .select({
          id: schema.activities.id,
          type: schema.activities.type,
          subject: schema.activities.subject,
          createdAt: schema.activities.createdAt,
          contactName: schema.contacts.name,
          dealTitle: schema.deals.title,
        })
        .from(schema.activities)
        .leftJoin(
          schema.contacts,
          eq(schema.activities.contactId, schema.contacts.id)
        )
        .leftJoin(
          schema.deals,
          eq(schema.activities.dealId, schema.deals.id)
        )
        .orderBy(desc(schema.activities.createdAt))
        .limit(5),
      db
        .select({ value: sql<number>`count(*)` })
        .from(schema.activities)
        .where(gte(schema.activities.createdAt, sevenDaysAgo)),
    ]);

    totalContacts = Number(contactRows[0]?.value ?? 0);

    const openDeals = allDeals.filter(
      (d) => d.stage !== "won" && d.stage !== "lost"
    );
    openDealsCount = openDeals.length;
    pipelineValue = openDeals.reduce(
      (sum, d) => sum + (d.value ? parseFloat(d.value) : 0),
      0
    );

    weekActivityCount = Number(weekRows[0]?.value ?? 0);
    recentActivities = activityRows;

    dealsByStage = STAGES.map((stage: Stage) => ({
      stage,
      count: allDeals.filter((d) => d.stage === stage).length,
      value: allDeals
        .filter((d) => d.stage === stage && d.value)
        .reduce((sum, d) => sum + parseFloat(d.value!), 0),
    }));
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-neutral-100">Dashboard</h2>
        <p className="mt-1 text-sm text-neutral-400">Your sales overview.</p>
      </div>

      {!db && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900 px-5 py-16 text-center">
          <p className="text-sm text-neutral-400">Database not connected.</p>
          <p className="text-xs text-neutral-600">
            Set{" "}
            <code className="rounded bg-neutral-800 px-1 py-0.5">
              DATABASE_URL
            </code>{" "}
            to connect your Neon database.
          </p>
        </div>
      )}

      {db && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Total Contacts"
              value={totalContacts.toString()}
            />
            <KpiCard label="Open Deals" value={openDealsCount.toString()} />
            <KpiCard
              label="Pipeline Value"
              value={formatCurrency(pipelineValue)}
            />
            <KpiCard
              label="Activities This Week"
              value={weekActivityCount.toString()}
            />
          </div>

          {/* Pipeline chart + AI digest */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <PipelineChart data={dealsByStage} />
            </div>
            <div className="lg:col-span-2">
              <AiDigest
                totalContacts={totalContacts}
                openDealsCount={openDealsCount}
                pipelineValue={pipelineValue}
                recentActivities={recentActivities.map((a) => ({
                  subject: a.subject,
                  type: a.type,
                  contactName: a.contactName,
                  dealTitle: a.dealTitle,
                }))}
                dealsByStage={dealsByStage}
              />
            </div>
          </div>

          {/* Recent activity */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-900">
            <div className="border-b border-neutral-800 px-5 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                Recent Activity
              </p>
            </div>
            {recentActivities.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm text-neutral-500">
                  No activity recorded yet.
                </p>
                <p className="mt-1 text-xs text-neutral-600">
                  Start by adding contacts and deals.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-neutral-800">
                {recentActivities.map((activity) => {
                  const meta = TYPE_META[activity.type] ?? {
                    label: activity.type,
                    color: "text-neutral-400",
                    bg: "bg-neutral-800",
                  };
                  const date = activity.createdAt
                    .toISOString()
                    .slice(0, 10);
                  return (
                    <li key={activity.id} className="flex gap-4 px-5 py-4">
                      <div className="mt-0.5 shrink-0">
                        <span
                          className={`inline-block rounded-full ${meta.bg} px-2 py-0.5 text-xs font-medium ${meta.color}`}
                        >
                          {meta.label}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-neutral-200">
                          {activity.subject}
                        </p>
                        <div className="mt-1 flex items-center gap-2 text-xs text-neutral-600">
                          <span>{date}</span>
                          {activity.contactName && (
                            <>
                              <span aria-hidden>·</span>
                              <span>{activity.contactName}</span>
                            </>
                          )}
                          {activity.dealTitle && (
                            <>
                              <span aria-hidden>·</span>
                              <span>{activity.dealTitle}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
