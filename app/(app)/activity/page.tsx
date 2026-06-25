import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import AddActivityForm from "./add-activity-form";
import ActivityToggle from "./activity-toggle";

type ActivityType = "call" | "email" | "meeting" | "note" | "task";

const TYPE_META: Record<ActivityType, { label: string; color: string; bg: string }> = {
  call: { label: "Call", color: "text-blue-400", bg: "bg-blue-900/30" },
  email: { label: "Email", color: "text-purple-400", bg: "bg-purple-900/30" },
  meeting: { label: "Meeting", color: "text-green-400", bg: "bg-green-900/30" },
  note: { label: "Note", color: "text-amber-400", bg: "bg-amber-900/30" },
  task: { label: "Task", color: "text-indigo-400", bg: "bg-indigo-900/30" },
};

export default async function ActivityPage() {
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
    .leftJoin(
      schema.deals,
      eq(schema.activities.dealId, schema.deals.id)
    )
    .orderBy(desc(schema.activities.createdAt))
    .limit(100);

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

        {rows.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-neutral-500">No activity recorded yet.</p>
            <p className="mt-1 text-xs text-neutral-600">
              Log your first activity above.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-neutral-800">
            {rows.map(({ activity, contactName, dealTitle }) => {
              const meta = TYPE_META[activity.type as ActivityType];
              const date = activity.createdAt.toISOString().slice(0, 10);
              const isCompleted = !!activity.completedAt;
              const now = new Date();
              const isOverdue = !!activity.dueAt && !isCompleted && activity.dueAt < now;
              return (
                <li key={activity.id} className="flex gap-4 px-5 py-4">
                  <ActivityToggle
                    activityId={activity.id}
                    isCompleted={isCompleted}
                    contactId={activity.contactId}
                    dealId={activity.dealId}
                  />
                  <div className={`mt-0.5 shrink-0 ${isCompleted ? "opacity-40" : ""}`}>
                    <span
                      className={`inline-block rounded-full ${meta.bg} px-2 py-0.5 text-xs font-medium ${meta.color}`}
                    >
                      {meta.label}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium ${isCompleted ? "text-neutral-500 line-through" : "text-neutral-200"}`}>
                      {activity.subject}
                    </p>
                    {activity.body && (
                      <p className={`mt-0.5 line-clamp-2 text-xs ${isCompleted ? "text-neutral-600" : "text-neutral-400"}`}>
                        {activity.body}
                      </p>
                    )}
                    <div className="mt-1 flex items-center gap-2 text-xs text-neutral-600">
                      <span>{date}</span>
                      {activity.dueAt && (
                        <>
                          <span aria-hidden>·</span>
                          <span className={isOverdue ? "text-amber-400" : "text-neutral-500"}>
                            Due {activity.dueAt.toISOString().slice(0, 10)}
                          </span>
                        </>
                      )}
                      {contactName && (
                        <>
                          <span aria-hidden>·</span>
                          <span>{contactName}</span>
                        </>
                      )}
                      {dealTitle && (
                        <>
                          <span aria-hidden>·</span>
                          <span>{dealTitle}</span>
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
    </div>
  );
}
