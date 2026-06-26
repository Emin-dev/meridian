import { and, eq, isNotNull, isNull, asc, desc } from "drizzle-orm";
import Link from "next/link";
import { getDb, schema } from "@/db";
import TaskToggle from "./task-toggle";
import TaskQuickAddForm from "./task-quick-add-form";
import { EmptyState } from "@/components/empty-state";
import { DemoDataButton } from "@/components/demo-data-button";

const TaskIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 11 12 14 22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
);

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
  // Completed tasks surface when they were finished; open tasks surface the due date.
  const stamp = completed && task.completedAt ? task.completedAt : task.dueAt;
  const formatted = new Date(stamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <div className={`flex min-h-[44px] items-center gap-3 py-2 ${completed ? "opacity-50" : ""}`}>
      <TaskToggle
        activityId={task.id}
        isCompleted={completed}
        contactId={task.contactId}
        dealId={task.dealId}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className={`text-body text-[--ink-1] ${completed ? "line-through" : ""}`}>
          {task.subject}
        </p>
        {(task.contactName || task.dealTitle) && (
          <div className="flex flex-wrap items-center gap-2 text-footnote text-[--ink-3]">
            {task.contactId && task.contactName && (
              <Link
                href={`/contacts/${task.contactId}`}
                className="transition-colors hover:text-[--accent]"
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
                className="transition-colors hover:text-[--accent]"
              >
                {task.dealTitle}
              </Link>
            )}
          </div>
        )}
      </div>
      <span className="shrink-0 text-footnote text-[--ink-3]">
        {completed ? `Done ${formatted}` : formatted}
      </span>
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
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[--line-1] px-4 py-3 sm:px-5">
        <span className={`h-2 w-2 rounded-full shrink-0 ${dotClass}`} />
        <p className="text-caption font-medium uppercase tracking-wide text-[--ink-2]">
          {title}
        </p>
        <span className="ml-auto text-caption text-[--ink-3]">{tasks.length}</span>
      </div>
      {tasks.length === 0 ? (
        <p className="px-4 py-4 text-body text-[--ink-3] sm:px-5">{emptyLabel}</p>
      ) : (
        <div className="divide-y divide-[--line-1] px-4 sm:px-5">
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
      <h2 className="text-title2 font-semibold text-[--ink-1]">Tasks</h2>
      <p className="mt-1 text-body text-[--ink-2]">
        Track and complete tasks across your contacts and deals.
      </p>
    </div>
  );

  const addCard = (
    <div className="card px-4 py-5 sm:px-6">
      <h3 className="mb-4 text-callout font-medium text-[--ink-1]">Add a task</h3>
      <TaskQuickAddForm />
    </div>
  );

  const db = getDb();

  if (!db) {
    return (
      <div className="space-y-6">
        {header}
        {addCard}
        <div className="card">
          <EmptyState
            icon={<TaskIcon />}
            title="Database not connected"
            description="Set DATABASE_URL to connect your Neon database."
          />
        </div>
      </div>
    );
  }

  const selection = {
    activity: schema.activities,
    contactName: schema.contacts.name,
    dealTitle: schema.deals.title,
  };
  const taskBase = (where: ReturnType<typeof and>) =>
    db
      .select(selection)
      .from(schema.activities)
      .leftJoin(
        schema.contacts,
        eq(schema.activities.contactId, schema.contacts.id)
      )
      .leftJoin(schema.deals, eq(schema.activities.dealId, schema.deals.id))
      .where(where);

  // Open tasks drive the time buckets; completed tasks are kept separate and
  // capped so the page stays bounded as history grows.
  const [activeRows, completedRows] = await Promise.all([
    taskBase(
      and(
        eq(schema.activities.type, "task"),
        isNotNull(schema.activities.dueAt),
        isNull(schema.activities.completedAt)
      )
    ).orderBy(asc(schema.activities.dueAt)),
    taskBase(
      and(
        eq(schema.activities.type, "task"),
        isNotNull(schema.activities.dueAt),
        isNotNull(schema.activities.completedAt)
      )
    )
      .orderBy(desc(schema.activities.completedAt))
      .limit(25),
  ]);

  const toTask = ({
    activity,
    contactName,
    dealTitle,
  }: (typeof activeRows)[number]): TaskRow => ({
    id: activity.id,
    subject: activity.subject,
    dueAt: activity.dueAt!.toISOString(),
    completedAt: activity.completedAt ? activity.completedAt.toISOString() : null,
    contactId: activity.contactId ?? null,
    dealId: activity.dealId ?? null,
    contactName: contactName ?? null,
    dealTitle: dealTitle ?? null,
  });

  const activeTasks = activeRows.map(toTask);
  const completedTasks = completedRows.map(toTask);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  const overdue = activeTasks.filter((t) => new Date(t.dueAt) < todayStart);
  const dueToday = activeTasks.filter((t) => {
    const d = new Date(t.dueAt);
    return d >= todayStart && d < tomorrowStart;
  });
  const upcoming = activeTasks.filter((t) => new Date(t.dueAt) >= tomorrowStart);

  const total = activeTasks.length + completedTasks.length;

  return (
    <div className="space-y-6">
      {header}
      {addCard}

      {total === 0 ? (
        <div className="card">
          <EmptyState
            icon={<TaskIcon />}
            title="No tasks yet"
            description="Add your first task using the form above, or log one from a contact or deal."
            action={
              <DemoDataButton
                label="Load demo data"
                className="tap inline-flex items-center gap-2 rounded-[--r-md] border border-[--line-1] bg-[--surface-2] px-3 text-caption font-medium text-[--ink-2] transition-colors hover:text-[--ink-1] disabled:opacity-50"
              />
            }
          />
        </div>
      ) : (
        <div className="space-y-4">
          <TaskGroup
            title="Overdue"
            tasks={overdue}
            dotClass="bg-[--bad]"
            emptyLabel="No overdue tasks."
          />
          <TaskGroup
            title="Due Today"
            tasks={dueToday}
            dotClass="bg-[--warn]"
            emptyLabel="Nothing due today."
          />
          <TaskGroup
            title="Upcoming"
            tasks={upcoming}
            dotClass="bg-[--accent]"
            emptyLabel="No upcoming tasks."
          />
          {completedTasks.length > 0 && (
            <TaskGroup
              title="Completed"
              tasks={completedTasks}
              dotClass="bg-[--ok]"
              emptyLabel="No completed tasks."
            />
          )}
        </div>
      )}
    </div>
  );
}
