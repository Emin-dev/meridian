import { and, eq, gte, isNull, lt } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { completeAgendaItem } from "./actions";

const TYPE_META: Record<string, { label: string; color: string; bg: string }> =
  {
    call: { label: "Call", color: "text-[var(--info)]", bg: "bg-[var(--info-tint)]" },
    email: {
      label: "Email",
      color: "text-[var(--accent)]",
      bg: "bg-[var(--accent-tint)]",
    },
    meeting: {
      label: "Meeting",
      color: "text-[var(--ok)]",
      bg: "bg-[var(--ok-tint)]",
    },
    note: { label: "Note", color: "text-[var(--warn)]", bg: "bg-[var(--warn-tint)]" },
    task: { label: "Task", color: "text-[var(--info)]", bg: "bg-[var(--info-tint)]" },
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
        className="tap flex shrink-0 items-center justify-center text-[var(--ink-3)] transition-colors hover:text-[var(--ok)]"
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
    <div className="card">
      <div className="border-b border-[var(--line-1)] px-5 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--ink-3)]">
          Today&apos;s Agenda
        </p>
      </div>

      {totalItems === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--ok-tint)] text-[var(--ok)]">
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
          <p className="text-sm font-medium text-[var(--ink-1)]">All clear for today</p>
          <p className="text-xs text-[var(--ink-3)]">
            No activities due, nothing overdue, no deals closing today.
          </p>
        </div>
      ) : (
        <div>
          {/* Overdue */}
          {overdue.length > 0 && (
            <div>
              <div className="border-b border-[var(--bad)]/30 bg-[var(--bad-tint)] px-5 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--bad)]">
                  Overdue &middot; {overdue.length}
                </p>
              </div>
              <ul className="divide-y divide-[var(--line-1)]">
                {overdue.map((item) => {
                  const meta = TYPE_META[item.type] ?? {
                    label: item.type,
                    color: "text-[var(--ink-2)]",
                    bg: "bg-[var(--surface-2)]",
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
                      <span className="shrink-0 inline-block rounded-full bg-[var(--bad-tint)] px-2 py-0.5 text-xs font-medium text-[var(--bad)]">
                        Overdue
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-[var(--ink-1)]">
                          {item.subject}
                        </p>
                        {item.contactName && (
                          <p className="truncate text-xs text-[var(--ink-3)]">
                            {item.contactName}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 text-xs font-medium text-[var(--bad)]">
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
            <div className={overdue.length > 0 ? "border-t border-[var(--line-1)]" : ""}>
              <div className="border-b border-[var(--line-1)] px-5 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-2)]">
                  Due Today &middot; {dueToday.length}
                </p>
              </div>
              <ul className="divide-y divide-[var(--line-1)]">
                {dueToday.map((item) => {
                  const meta = TYPE_META[item.type] ?? {
                    label: item.type,
                    color: "text-[var(--ink-2)]",
                    bg: "bg-[var(--surface-2)]",
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
                        <p className="truncate text-sm text-[var(--ink-1)]">
                          {item.subject}
                        </p>
                        {item.contactName && (
                          <p className="truncate text-xs text-[var(--ink-3)]">
                            {item.contactName}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 text-xs text-[var(--ink-3)]">
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
                  ? "border-t border-[var(--line-1)]"
                  : ""
              }
            >
              <div className="border-b border-[var(--line-1)] px-5 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--warn)]">
                  Deals Closing Today &middot; {closingToday.length}
                </p>
              </div>
              <ul className="divide-y divide-[var(--line-1)]">
                {closingToday.map((deal) => (
                  <li key={deal.id} className="flex min-h-11 items-center gap-3 px-5 py-2">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--warn)]/50 text-[var(--warn)]">
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
                    <span className="shrink-0 inline-block rounded-full bg-[var(--warn-tint)] px-2 py-0.5 text-xs font-medium text-[var(--warn)]">
                      Deal
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-[var(--ink-1)]">
                        {deal.title}
                      </p>
                      {deal.contactName && (
                        <p className="truncate text-xs text-[var(--ink-3)]">
                          {deal.contactName}
                        </p>
                      )}
                    </div>
                    {deal.value && (
                      <span className="shrink-0 text-xs font-medium text-[var(--ink-1)]">
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
