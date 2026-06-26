import { and, asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import TaskToggle from "./task-toggle";
import LinkedTaskAddForm from "./linked-tasks-add-form";

interface Props {
  contactId?: number;
  dealId?: number;
}

export default async function LinkedTasksSection({ contactId, dealId }: Props) {
  const db = getDb();

  type TaskRow = {
    id: number;
    subject: string;
    dueAt: Date | null;
    completedAt: Date | null;
    contactId: number | null;
    dealId: number | null;
  };

  let tasks: TaskRow[] = [];

  if (db) {
    const typeCond = eq(schema.activities.type, "task");
    const contactCond =
      contactId !== undefined ? eq(schema.activities.contactId, contactId) : undefined;
    const dealCond =
      dealId !== undefined ? eq(schema.activities.dealId, dealId) : undefined;

    tasks = await db
      .select({
        id: schema.activities.id,
        subject: schema.activities.subject,
        dueAt: schema.activities.dueAt,
        completedAt: schema.activities.completedAt,
        contactId: schema.activities.contactId,
        dealId: schema.activities.dealId,
      })
      .from(schema.activities)
      .where(and(typeCond, contactCond, dealCond))
      .orderBy(asc(schema.activities.dueAt), asc(schema.activities.createdAt));
  }

  const count = tasks.length;

  return (
    <details className="group" open>
      <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
        <h3 className="flex-1 text-sm font-medium text-neutral-300">
          Tasks
          {count > 0 && (
            <span className="ml-2 rounded-full bg-neutral-800 px-1.5 py-0.5 text-xs font-normal text-neutral-500">
              {count}
            </span>
          )}
        </h3>
        <span className="text-xs text-neutral-500 transition-transform duration-150 group-open:rotate-180">
          ▾
        </span>
      </summary>

      <div className="mt-4 space-y-4">
        {!db ? (
          <p className="text-xs text-[--ink-3]">Connect a database to manage tasks.</p>
        ) : (
          <>
            <LinkedTaskAddForm contactId={contactId ?? null} dealId={dealId ?? null} />

            {count === 0 ? (
              <p className="text-sm text-[--ink-3]">No tasks yet.</p>
            ) : (
              <ul className="divide-y divide-neutral-800">
                {tasks.map((task) => {
                  const completed = !!task.completedAt;
                  const dueStr = task.dueAt
                    ? task.dueAt.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })
                    : null;
                  return (
                    <li
                      key={task.id}
                      className={`flex items-start gap-3 py-3 ${completed ? "opacity-50" : ""}`}
                    >
                      <TaskToggle
                        activityId={task.id}
                        isCompleted={completed}
                        contactId={task.contactId ?? null}
                        dealId={task.dealId ?? null}
                      />
                      <span
                        className={`flex-1 text-sm ${
                          completed
                            ? "text-neutral-500 line-through"
                            : "text-neutral-200"
                        }`}
                      >
                        {task.subject}
                      </span>
                      {dueStr && (
                        <span className="shrink-0 text-xs text-neutral-500">
                          {dueStr}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </details>
  );
}
