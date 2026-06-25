import { and, desc, eq, gte, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import Link from "next/link";
import { getDb, schema } from "@/db";
import AiDigest from "@/components/ai-digest";
import PipelineChart from "@/components/pipeline-chart-wrapper";
import { OnboardingBanner } from "@/components/onboarding-banner";
import TodayAgenda from "./today-agenda";
import StaleDeals from "./stale-deals";

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
  let weightedPipelineValue = 0;
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
  let overdueCount = 0;
  let topContacts: { name: string; leadScore: number }[] = [];
  let overdueActivities: Array<{
    id: number;
    type: string;
    subject: string;
    dueAt: Date;
    contactName: string | null;
  }> = [];
  let sequencesDue: Array<{
    enrollmentId: number;
    contactId: number;
    sequenceId: number;
    contactName: string;
    sequenceName: string;
    stepNum: number;
    totalSteps: number;
    nextStepDueDate: Date;
  }> = [];
  let initialDigestBullets: string[] | undefined;
  let initialDigestCachedAt: string | undefined;

  if (db) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const now = new Date();

    const [contactRows, allDeals, activityRows, weekRows, overdueRows, topContactRows, overdueActivityRows, activeEnrollmentRows] = await Promise.all([
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
      db
        .select({ value: sql<number>`count(*)` })
        .from(schema.activities)
        .where(
          and(
            lt(schema.activities.dueAt, now),
            isNull(schema.activities.completedAt)
          )
        ),
      db
        .select({ name: schema.contacts.name, leadScore: schema.contacts.leadScore })
        .from(schema.contacts)
        .where(isNotNull(schema.contacts.leadScore))
        .orderBy(desc(schema.contacts.leadScore))
        .limit(3),
      db
        .select({
          id: schema.activities.id,
          type: schema.activities.type,
          subject: schema.activities.subject,
          dueAt: schema.activities.dueAt,
          contactName: schema.contacts.name,
        })
        .from(schema.activities)
        .leftJoin(
          schema.contacts,
          eq(schema.activities.contactId, schema.contacts.id)
        )
        .where(
          and(
            lt(schema.activities.dueAt, now),
            isNull(schema.activities.completedAt)
          )
        )
        .orderBy(schema.activities.dueAt)
        .limit(5),
      db
        .select({
          enrollmentId: schema.contactSequenceEnrollments.id,
          contactId: schema.contactSequenceEnrollments.contactId,
          sequenceId: schema.contactSequenceEnrollments.sequenceId,
          enrolledAt: schema.contactSequenceEnrollments.enrolledAt,
          currentStepPosition: schema.contactSequenceEnrollments.currentStepPosition,
          contactName: schema.contacts.name,
          sequenceName: schema.sequences.name,
        })
        .from(schema.contactSequenceEnrollments)
        .innerJoin(schema.contacts, eq(schema.contactSequenceEnrollments.contactId, schema.contacts.id))
        .innerJoin(schema.sequences, eq(schema.contactSequenceEnrollments.sequenceId, schema.sequences.id))
        .where(eq(schema.contactSequenceEnrollments.status, "active")),
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
    weightedPipelineValue = openDeals.reduce(
      (sum, d) => sum + (d.value ? parseFloat(d.value) * (d.probability / 100) : 0),
      0
    );

    weekActivityCount = Number(weekRows[0]?.value ?? 0);
    recentActivities = activityRows;
    overdueCount = Number(overdueRows[0]?.value ?? 0);
    overdueActivities = overdueActivityRows
      .filter((a) => a.dueAt !== null)
      .map((a) => ({ ...a, dueAt: a.dueAt as Date }));
    topContacts = topContactRows.map((c) => ({
      name: c.name,
      leadScore: c.leadScore ?? 0,
    }));

    dealsByStage = STAGES.map((stage: Stage) => ({
      stage,
      count: allDeals.filter((d) => d.stage === stage).length,
      value: allDeals
        .filter((d) => d.stage === stage && d.value)
        .reduce((sum, d) => sum + parseFloat(d.value!), 0),
    }));

    if (activeEnrollmentRows.length > 0) {
      const seqIds = [...new Set(activeEnrollmentRows.map((e) => e.sequenceId))];
      const stepRows = await db
        .select({
          sequenceId: schema.sequenceSteps.sequenceId,
          position: schema.sequenceSteps.position,
          delayDays: schema.sequenceSteps.delayDays,
        })
        .from(schema.sequenceSteps)
        .where(inArray(schema.sequenceSteps.sequenceId, seqIds));

      const stepsBySeq = new Map<number, { position: number; delayDays: number }[]>();
      for (const step of stepRows) {
        const arr = stepsBySeq.get(step.sequenceId) ?? [];
        arr.push({ position: step.position, delayDays: step.delayDays });
        stepsBySeq.set(step.sequenceId, arr);
      }

      sequencesDue = activeEnrollmentRows
        .map((e) => {
          const steps = stepsBySeq.get(e.sequenceId) ?? [];
          const sorted = [...steps].sort((a, b) => a.position - b.position);
          const totalSteps = sorted.length;
          const cumulativeDelays = sorted.reduce<number[]>((acc, step) => {
            acc.push((acc.at(-1) ?? 0) + step.delayDays);
            return acc;
          }, []);
          if (
            totalSteps === 0 ||
            e.currentStepPosition >= totalSteps ||
            e.currentStepPosition >= cumulativeDelays.length
          ) {
            return null;
          }
          const nextStepDueDate = new Date(
            e.enrolledAt.getTime() + cumulativeDelays[e.currentStepPosition] * 86_400_000
          );
          if (nextStepDueDate > now) return null;
          return {
            enrollmentId: e.enrollmentId,
            contactId: e.contactId,
            sequenceId: e.sequenceId,
            contactName: e.contactName,
            sequenceName: e.sequenceName,
            stepNum: e.currentStepPosition + 1,
            totalSteps,
            nextStepDueDate,
          };
        })
        .filter((e): e is NonNullable<typeof e> => e !== null)
        .sort((a, b) => a.nextStepDueDate.getTime() - b.nextStepDueDate.getTime())
        .slice(0, 5);
    }

    // Read cached AI digest (serve without AI call if under 4 hours old)
    try {
      const digestRows = await db
        .select()
        .from(schema.appSettings)
        .where(inArray(schema.appSettings.key, ["digestCache", "digestCachedAt"]));
      const cacheMap: Record<string, string> = {};
      for (const row of digestRows) cacheMap[row.key] = row.value;
      if (cacheMap.digestCache && cacheMap.digestCachedAt) {
        const age = Date.now() - new Date(cacheMap.digestCachedAt).getTime();
        if (age < 4 * 60 * 60 * 1000) {
          initialDigestBullets = cacheMap.digestCache
            .split("\n")
            .map((line) => line.replace(/^[•\-\*]\s*/, "").trim())
            .filter(Boolean);
          initialDigestCachedAt = cacheMap.digestCachedAt;
        }
      }
    } catch {
      // Non-fatal
    }
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

      {db && totalContacts === 0 && <OnboardingBanner />}

      {db && totalContacts > 0 && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
              label="Weighted Pipeline"
              value={formatCurrency(weightedPipelineValue)}
            />
            <KpiCard
              label="Activities This Week"
              value={weekActivityCount.toString()}
            />
          </div>

          {/* Today's agenda */}
          <TodayAgenda />

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
                overdueCount={overdueCount}
                topContacts={topContacts}
                initialBullets={initialDigestBullets}
                initialCachedAt={initialDigestCachedAt}
              />
            </div>
          </div>

          {/* Stale deals */}
          <StaleDeals />

          {/* Overdue activities alert */}
          {overdueActivities.length > 0 && (
            <div className="rounded-xl border border-red-800/60 bg-red-950/20">
              <div className="flex items-center gap-2 border-b border-red-800/60 px-5 py-3">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-4 w-4 shrink-0 text-red-400"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                    clipRule="evenodd"
                  />
                </svg>
                <p className="text-xs font-medium uppercase tracking-wide text-red-400">
                  Overdue Activities
                  {overdueCount > 5 && (
                    <span className="ml-1 font-normal normal-case text-red-500">
                      ({overdueCount} total)
                    </span>
                  )}
                </p>
              </div>
              <ul className="divide-y divide-red-900/30">
                {overdueActivities.map((activity) => {
                  const meta = TYPE_META[activity.type] ?? {
                    label: activity.type,
                    color: "text-neutral-400",
                    bg: "bg-neutral-800",
                  };
                  const msOverdue = Date.now() - activity.dueAt.getTime();
                  const daysOverdue = Math.floor(
                    msOverdue / (1000 * 60 * 60 * 24)
                  );
                  return (
                    <li key={activity.id} className="flex items-center gap-4 px-5 py-4">
                      <div className="shrink-0">
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
                        {activity.contactName && (
                          <p className="mt-0.5 text-xs text-neutral-500">
                            {activity.contactName}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="text-xs font-semibold text-red-400">
                          {daysOverdue === 0
                            ? "Due today"
                            : daysOverdue === 1
                            ? "1 day overdue"
                            : `${daysOverdue} days overdue`}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Sequences due */}
          {sequencesDue.length > 0 && (
            <div className="rounded-xl border border-amber-800/60 bg-amber-950/20">
              <div className="flex items-center gap-2 border-b border-amber-800/60 px-5 py-3">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-4 w-4 shrink-0 text-amber-400"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z"
                    clipRule="evenodd"
                  />
                </svg>
                <p className="text-xs font-medium uppercase tracking-wide text-amber-400">
                  Sequences Due
                </p>
              </div>
              <ul className="divide-y divide-amber-900/30">
                {sequencesDue.map((item) => {
                  const msOverdue = Date.now() - item.nextStepDueDate.getTime();
                  const daysOverdue = Math.floor(msOverdue / (1000 * 60 * 60 * 24));
                  return (
                    <li key={item.enrollmentId} className="flex items-center gap-4 px-5 py-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-neutral-200">
                          {item.contactName}
                        </p>
                        <p className="mt-0.5 text-xs text-neutral-500">
                          {item.sequenceName} · Step {item.stepNum} of {item.totalSteps}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="text-xs font-semibold text-amber-400">
                          {daysOverdue === 0
                            ? "Due today"
                            : daysOverdue === 1
                            ? "1 day overdue"
                            : `${daysOverdue} days overdue`}
                        </span>
                        <Link
                          href={`/sequences/${item.sequenceId}`}
                          className="text-xs text-amber-400 hover:text-amber-300 hover:underline"
                        >
                          View →
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

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
