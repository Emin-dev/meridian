import { and, eq, gte, isNull, lt } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { completeAgendaItem } from "./actions";

const TYPE_META: Record<string, { label: string; color: string; bg: string }> =
  {
    call: { label: "Call", color: "text-blue-400", bg: "bg-blue-900/30" },
    email: { label: "Email", color: "text-purple-400", bg: "bg-purple-900/30" },
    meeting: {
      label: "Meeting",
      color: "text-green-400",
      bg: "bg-green-900/30",
    },
    note: { label: "Note", color: "text-amber-400", bg: "bg-amber-900/30" },
    task: { label: "Task", color: "text-indigo-400", bg: "bg-indigo-900/30" },
  };

function formatCurrency(value: string | null) {
  if (!value) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(parseFloat(value));
}

function CompleteButton({ id }: { id: number }) {
  const action = completeAgendaItem.bind(null, id);
  return (
    <form action={action}>
      <button
        type="submit"
        title="Mark complete"
        className="tap flex shrink-0 items-center justify-center text-neutral-600 transition-colors hover:text-green-500"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full border border-current">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            fill="currentColor"
            className="h-3 w-3"
          >
            <path
              fillRule="evenodd"
              d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      </button>
    </form>
  );
}

export default async function TodayAgenda() {
  const db = getDb();
  if (!db) return null;

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const [dueTodayRows, overdueRows, closingTodayRows] = await Promise.all([
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
          gte(schema.activities.dueAt, todayStart),
          lt(schema.activities.dueAt, todayEnd),
          isNull(schema.activities.completedAt)
        )
      )
      .orderBy(schema.activities.dueAt),

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
          lt(schema.activities.dueAt, todayStart),
          isNull(schema.activities.completedAt)
        )
      )
      .orderBy(schema.activities.dueAt)
      .limit(10),

    db
      .select({
        id: schema.deals.id,
        title: schema.deals.title,
        stage: schema.deals.stage,
        value: schema.deals.value,
        contactName: schema.contacts.name,
      })
      .from(schema.deals)
      .leftJoin(
        schema.contacts,
        eq(schema.deals.contactId, schema.contacts.id)
      )
      .where(
        and(
          gte(schema.deals.expectedCloseDate, todayStart),
          lt(schema.deals.expectedCloseDate, todayEnd)
        )
      ),
  ]);

  const dueToday = dueTodayRows
    .filter((a): a is typeof a & { dueAt: Date } => a.dueAt !== null);

  const overdue = overdueRows
    .filter((a): a is typeof a & { dueAt: Date } => a.dueAt !== null);

  const closingToday = closingTodayRows.filter(
    (d) => d.stage !== "won" && d.stage !== "lost"
  );

  const totalItems = dueToday.length + overdue.length + closingToday.length;

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900">
      <div className="border-b border-neutral-800 px-5 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          Today&apos;s Agenda
        </p>
      </div>

      {totalItems === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-900/30 text-green-400">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-5 w-5"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <p className="text-sm font-medium text-neutral-300">All clear for today</p>
          <p className="text-xs text-neutral-500">
            No activities due, nothing overdue, no deals closing today.
          </p>
        </div>
      ) : (
        <div>
          {/* Overdue */}
          {overdue.length > 0 && (
            <div>
              <div className="border-b border-red-900/30 bg-red-950/20 px-5 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-red-400">
                  Overdue &middot; {overdue.length}
                </p>
              </div>
              <ul className="divide-y divide-neutral-800/60">
                {overdue.map((item) => {
                  const meta = TYPE_META[item.type] ?? {
                    label: item.type,
                    color: "text-neutral-400",
                    bg: "bg-neutral-800",
                  };
                  const daysOverdue = Math.floor(
                    (now.getTime() - item.dueAt.getTime()) / (1000 * 60 * 60 * 24)
                  );
                  return (
                    <li key={item.id} className="flex min-h-11 items-center gap-3 px-5 py-2">
                      <CompleteButton id={item.id} />
                      <span
                        className={`shrink-0 inline-block rounded-full ${meta.bg} px-2 py-0.5 text-xs font-medium ${meta.color}`}
                      >
                        {meta.label}
                      </span>
                      <span className="shrink-0 inline-block rounded-full bg-red-900/30 px-2 py-0.5 text-xs font-medium text-red-400">
                        Overdue
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-neutral-200">
                          {item.subject}
                        </p>
                        {item.contactName && (
                          <p className="truncate text-xs text-neutral-500">
                            {item.contactName}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 text-xs font-medium text-red-400">
                        {daysOverdue <= 1
                          ? "1 day ago"
                          : `${daysOverdue}d ago`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Due today */}
          {dueToday.length > 0 && (
            <div className={overdue.length > 0 ? "border-t border-neutral-800" : ""}>
              <div className="border-b border-neutral-800/60 px-5 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Due Today &middot; {dueToday.length}
                </p>
              </div>
              <ul className="divide-y divide-neutral-800/60">
                {dueToday.map((item) => {
                  const meta = TYPE_META[item.type] ?? {
                    label: item.type,
                    color: "text-neutral-400",
                    bg: "bg-neutral-800",
                  };
                  const time = item.dueAt.toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  });
                  return (
                    <li key={item.id} className="flex min-h-11 items-center gap-3 px-5 py-2">
                      <CompleteButton id={item.id} />
                      <span
                        className={`shrink-0 inline-block rounded-full ${meta.bg} px-2 py-0.5 text-xs font-medium ${meta.color}`}
                      >
                        {meta.label}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-neutral-200">
                          {item.subject}
                        </p>
                        {item.contactName && (
                          <p className="truncate text-xs text-neutral-500">
                            {item.contactName}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 text-xs text-neutral-500">
                        {time}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Deals closing today */}
          {closingToday.length > 0 && (
            <div
              className={
                overdue.length > 0 || dueToday.length > 0
                  ? "border-t border-neutral-800"
                  : ""
              }
            >
              <div className="border-b border-neutral-800/60 px-5 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-500">
                  Deals Closing Today &middot; {closingToday.length}
                </p>
              </div>
              <ul className="divide-y divide-neutral-800/60">
                {closingToday.map((deal) => (
                  <li key={deal.id} className="flex min-h-11 items-center gap-3 px-5 py-2">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-amber-700/50 text-amber-500">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 16 16"
                        fill="currentColor"
                        className="h-3 w-3"
                      >
                        <path
                          fillRule="evenodd"
                          d="M15 8A7 7 0 1 1 1 8a7 7 0 0 1 14 0ZM9 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM6.75 8a.75.75 0 0 0 0 1.5h.75v1.75a.75.75 0 0 0 1.5 0v-2.5A.75.75 0 0 0 8.25 8h-1.5Z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <span className="shrink-0 inline-block rounded-full bg-amber-900/30 px-2 py-0.5 text-xs font-medium text-amber-400">
                      Deal
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-neutral-200">
                        {deal.title}
                      </p>
                      {deal.contactName && (
                        <p className="truncate text-xs text-neutral-500">
                          {deal.contactName}
                        </p>
                      )}
                    </div>
                    {deal.value && (
                      <span className="shrink-0 text-xs font-medium text-neutral-300">
                        {formatCurrency(deal.value)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
