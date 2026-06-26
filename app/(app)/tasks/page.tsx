import { and, eq, isNotNull, isNull, asc, desc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import TaskQuickAddForm from "./task-quick-add-form";
import TaskRow, { type TaskRowData } from "./task-row";
import { EmptyState } from "@/components/empty-state";
import { DemoDataButton } from "@/components/demo-data-button";
import FocusAddTaskButton from "./focus-add-task-button";

const TaskIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 11 12 14 22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
);

function TaskGroup({
  title,
  tasks,
  dotClass,
  emptyLabel,
}: {
  title: string;
  tasks: TaskRowData[];
  dotClass: string;
  emptyLabel: string;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[var(--line-1)] px-4 py-3 sm:px-5">
        <span className={`h-2 w-2 rounded-full shrink-0 ${dotClass}`} />
        <p className="text-caption font-medium uppercase tracking-wide text-[var(--ink-2)]">
          {title}
        </p>
        <span className="ml-auto text-caption text-[var(--ink-3)]">{tasks.length}</span>
      </div>
      {tasks.length === 0 ? (
        <p className="px-4 py-4 text-body text-[var(--ink-3)] sm:px-5">{emptyLabel}</p>
      ) : (
        <div className="divide-y divide-[var(--line-1)] px-4 sm:px-5">
          {tasks.map((t) => (
            <TaskRow key={t.id} task={t} />
          ))}
        </div>
      )}
    </div>
  );
}

export default async function TasksPage() {
  const header = (
    <div>
      <h2 className="text-title2 font-semibold text-[var(--ink-1)]">Tasks</h2>
      <p className="mt-1 text-body text-[var(--ink-2)]">
        Track and complete tasks across your contacts and deals.
      </p>
    </div>
  );

  const addCard = (
    <div className="card px-4 py-5 sm:px-6">
      <h3 className="mb-4 text-callout font-medium text-[var(--ink-1)]">Add a task</h3>
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
  }: (typeof activeRows)[number]): TaskRowData => ({
    id: activity.id,
    subject: activity.subject,
    body: activity.body ?? null,
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
              <div className="flex flex-wrap items-center justify-center gap-2">
                <FocusAddTaskButton />
                <DemoDataButton
                  label="Load demo data"
                  className="tap inline-flex items-center gap-2 rounded-[var(--r-md)] border border-[var(--line-1)] bg-[var(--surface-2)] px-3 text-caption font-medium text-[var(--ink-2)] transition-colors hover:text-[var(--ink-1)] disabled:opacity-50"
                />
              </div>
            }
          />
        </div>
      ) : (
        <div className="space-y-4">
          <TaskGroup
            title="Overdue"
            tasks={overdue}
            dotClass="bg-[var(--bad)]"
            emptyLabel="No overdue tasks."
          />
          <TaskGroup
            title="Due Today"
            tasks={dueToday}
            dotClass="bg-[var(--warn)]"
            emptyLabel="Nothing due today."
          />
          <TaskGroup
            title="Upcoming"
            tasks={upcoming}
            dotClass="bg-[var(--accent)]"
            emptyLabel="No upcoming tasks."
          />
          {completedTasks.length > 0 && (
            <TaskGroup
              title="Completed"
              tasks={completedTasks}
              dotClass="bg-[var(--ok)]"
              emptyLabel="No completed tasks."
            />
          )}
        </div>
      )}
    </div>
  );
}
