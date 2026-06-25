import { eq, desc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Activity } from "@/db/schema";
import InlineActivityForm from "./inline-activity-form";
import ActivityToggle from "@/app/(app)/activity/activity-toggle";
import ActivityUndoButton from "@/app/(app)/activity/activity-undo-button";

function formatCompletedAt(date: Date): string {
  const dateStr = date.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  const timeStr = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${dateStr} at ${timeStr}`;
}

type ActivityType = Activity["type"];

const TYPE_META: Record<ActivityType, { label: string; color: string; bg: string }> = {
  call: { label: "Call", color: "text-blue-400", bg: "bg-blue-900/30" },
  email: { label: "Email", color: "text-purple-400", bg: "bg-purple-900/30" },
  meeting: { label: "Meeting", color: "text-green-400", bg: "bg-green-900/30" },
  note: { label: "Note", color: "text-amber-400", bg: "bg-amber-900/30" },
  task: { label: "Task", color: "text-indigo-400", bg: "bg-indigo-900/30" },
};

interface Props {
  contactId: number;
}

export default async function ActivityTimeline({ contactId }: Props) {
  const db = getDb();

  let activities: Activity[] = [];
  if (db) {
    activities = await db
      .select()
      .from(schema.activities)
      .where(eq(schema.activities.contactId, contactId))
      .orderBy(desc(schema.activities.createdAt));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-neutral-300">Activity timeline</h3>
        {db && <InlineActivityForm contactId={contactId} />}
      </div>

      {!db && (
        <p className="text-xs text-neutral-500">
          Connect a database to log and view activities.
        </p>
      )}

      {db && activities.length === 0 && (
        <p className="py-4 text-center text-sm text-neutral-500">
          No activities yet. Log one above.
        </p>
      )}

      {activities.length > 0 && (
        <ul className="space-y-2">
          {activities.map((a) => {
            const meta = TYPE_META[a.type];
            const date = a.createdAt.toISOString().slice(0, 10);
            const isCompleted = !!a.completedAt;
            const now = new Date();
            const isOverdue = !!a.dueAt && !isCompleted && a.dueAt < now;
            return (
              <li
                key={a.id}
                className="flex gap-3 rounded-lg border border-neutral-800 bg-neutral-900/50 px-4 py-3"
              >
                <ActivityToggle
                  activityId={a.id}
                  isCompleted={isCompleted}
                  contactId={a.contactId}
                  dealId={a.dealId}
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
                    {a.subject}
                  </p>
                  {a.body && (
                    <p className={`mt-0.5 line-clamp-2 text-xs ${isCompleted ? "text-neutral-600" : "text-neutral-400"}`}>
                      {a.body}
                    </p>
                  )}
                  <div className="mt-1 flex items-center gap-2 text-xs text-neutral-600">
                    <span>{date}</span>
                    {a.dueAt && (
                      <>
                        <span aria-hidden>·</span>
                        <span className={isOverdue ? "text-amber-400" : "text-neutral-500"}>
                          Due {a.dueAt.toISOString().slice(0, 10)}
                        </span>
                      </>
                    )}
                    {isCompleted && a.completedAt && (
                      <>
                        <span aria-hidden>·</span>
                        <span className="text-neutral-500">
                          Completed {formatCompletedAt(a.completedAt)}
                        </span>
                        <span aria-hidden>·</span>
                        <ActivityUndoButton
                          activityId={a.id}
                          contactId={a.contactId}
                          dealId={a.dealId}
                        />
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
  );
}
