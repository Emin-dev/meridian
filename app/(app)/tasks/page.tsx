import { and, eq, isNotNull, asc } from "drizzle-orm";
import Link from "next/link";
import { getDb, schema } from "@/db";
import TaskToggle from "./task-toggle";
import TaskQuickAddForm from "./task-quick-add-form";

type TaskRow = {
  id: number;
  subject: string;
  dueAt: string;
  completedAt: string | null;
  contactId: number | null;
  dealId: number | null;
  contactName: string | null;
  dealTitle: string | null;
};

function TaskItem({ task }: { task: TaskRow }) {
  const completed = !!task.completedAt;
  const dueDate = new Date(task.dueAt);
  const formatted = dueDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <div className={`flex items-start gap-3 py-3 ${completed ? "opacity-50" : ""}`}>
      <TaskToggle
        activityId={task.id}
        isCompleted={completed}
        contactId={task.contactId}
        dealId={task.dealId}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className={`text-sm text-neutral-100 ${completed ? "line-through" : ""}`}>
          {task.subject}
        </p>
        {(task.contactName || task.dealTitle) && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
            {task.contactId && task.contactName && (
              <Link
                href={`/contacts/${task.contactId}`}
                className="transition-colors hover:text-indigo-400"
              >
                {task.contactName}
              </Link>
            )}
            {task.contactId && task.contactName && task.dealId && task.dealTitle && (
              <span>·</span>
            )}
            {task.dealId && task.dealTitle && (
              <Link
                href={`/deals/${task.dealId}`}
                className="transition-colors hover:text-indigo-400"
              >
                {task.dealTitle}
              </Link>
            )}
          </div>
        )}
      </div>
      <span className="shrink-0 text-xs text-neutral-500">{formatted}</span>
    </div>
  );
}

function TaskGroup({
  title,
  tasks,
  dotClass,
  emptyLabel,
}: {
  title: string;
  tasks: TaskRow[];
  dotClass: string;
  emptyLabel: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900">
      <div className="flex items-center gap-2 border-b border-neutral-800 px-5 py-3">
        <span className={`h-2 w-2 rounded-full ${dotClass}`} />
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
          {title}
        </p>
        <span className="ml-auto text-xs text-neutral-600">{tasks.length}</span>
      </div>
      {tasks.length === 0 ? (
        <p className="px-5 py-4 text-sm text-neutral-600">{emptyLabel}</p>
      ) : (
        <div className="divide-y divide-neutral-800 px-5">
          {tasks.map((t) => (
            <TaskItem key={t.id} task={t} />
          ))}
        </div>
      )}
    </div>
  );
}

export default async function TasksPage() {
  const header = (
    <div>
      <h2 className="text-xl font-semibold text-neutral-100">Tasks</h2>
      <p className="mt-1 text-sm text-neutral-400">
        Track and complete tasks across your contacts and deals.
      </p>
    </div>
  );

  const addCard = (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-6 py-5">
      <h3 className="mb-4 text-sm font-medium text-neutral-300">Add a task</h3>
      <TaskQuickAddForm />
    </div>
  );

  const db = getDb();

  if (!db) {
    return (
      <div className="space-y-6">
        {header}
        {addCard}
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-5 py-8 text-center">
          <p className="text-sm text-neutral-400">Database not connected.</p>
          <p className="mt-1 text-xs text-neutral-600">
            Set{" "}
            <code className="rounded bg-neutral-800 px-1 py-0.5">DATABASE_URL</code>{" "}
            to connect your Neon database.
          </p>
        </div>
      </div>
    );
  }

  const rows = await db
    .select({
      activity: schema.activities,
      contactName: schema.contacts.name,
      dealTitle: schema.deals.title,
    })
    .from(schema.activities)
    .leftJoin(schema.contacts, eq(schema.activities.contactId, schema.contacts.id))
    .leftJoin(schema.deals, eq(schema.activities.dealId, schema.deals.id))
    .where(
      and(
        eq(schema.activities.type, "task"),
        isNotNull(schema.activities.dueAt)
      )
    )
    .orderBy(asc(schema.activities.dueAt));

  const tasks: TaskRow[] = rows.map(({ activity, contactName, dealTitle }) => ({
    id: activity.id,
    subject: activity.subject,
    dueAt: activity.dueAt!.toISOString(),
    completedAt: activity.completedAt ? activity.completedAt.toISOString() : null,
    contactId: activity.contactId ?? null,
    dealId: activity.dealId ?? null,
    contactName: contactName ?? null,
    dealTitle: dealTitle ?? null,
  }));

  const now = new Date();
  const todayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);

  const overdue = tasks.filter((t) => new Date(t.dueAt) < todayStart);
  const dueToday = tasks.filter((t) => {
    const d = new Date(t.dueAt);
    return d >= todayStart && d < tomorrowStart;
  });
  const upcoming = tasks.filter((t) => new Date(t.dueAt) >= tomorrowStart);

  const total = tasks.length;

  return (
    <div className="space-y-6">
      {header}
      {addCard}

      {total === 0 ? (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-5 py-10 text-center">
          <p className="text-sm text-neutral-400">No tasks yet.</p>
          <p className="mt-1 text-xs text-neutral-600">
            Add your first task above or log one from a contact or deal.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <TaskGroup
            title="Overdue"
            tasks={overdue}
            dotClass="bg-red-500"
            emptyLabel="No overdue tasks."
          />
          <TaskGroup
            title="Due Today"
            tasks={dueToday}
            dotClass="bg-amber-400"
            emptyLabel="Nothing due today."
          />
          <TaskGroup
            title="Upcoming"
            tasks={upcoming}
            dotClass="bg-indigo-500"
            emptyLabel="No upcoming tasks."
          />
        </div>
      )}
    </div>
  );
}
