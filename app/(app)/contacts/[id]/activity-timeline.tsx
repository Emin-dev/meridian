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
  call: { label: "Call", color: "text-[--info]", bg: "bg-[--info-tint]" },
  email: { label: "Email", color: "text-[--accent]", bg: "bg-[--accent-tint]" },
  meeting: { label: "Meeting", color: "text-[--ok]", bg: "bg-[--ok-tint]" },
  note: { label: "Note", color: "text-[--warn]", bg: "bg-[--warn-tint]" },
  task: { label: "Task", color: "text-[--accent]", bg: "bg-[--accent-tint]" },
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
        <h3 className="text-sm font-medium text-[--ink-2]">Activity timeline</h3>
        {db && <InlineActivityForm contactId={contactId} />}
      </div>

      {!db && (
        <p className="text-xs text-[--ink-3]">
          Connect a database to log and view activities.
        </p>
      )}

      {db && activities.length === 0 && (
        <p className="py-4 text-center text-sm text-[--ink-3]">
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
                className="flex gap-3 rounded-lg border border-[--line-1] bg-[--surface-1] px-4 py-3"
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
                  <p className={`text-sm font-medium ${isCompleted ? "text-[--ink-3] line-through" : "text-[--ink-1]"}`}>
                    {a.subject}
                  </p>
                  {a.body && (
                    <p className={`mt-0.5 line-clamp-2 text-xs ${isCompleted ? "text-[--ink-3]" : "text-[--ink-2]"}`}>
                      {a.body}
                    </p>
                  )}
                  <div className="mt-1 flex items-center gap-2 text-xs text-[--ink-3]">
                    <span>{date}</span>
                    {a.dueAt && (
                      <>
                        <span aria-hidden>·</span>
                        <span className={isOverdue ? "text-[--warn]" : "text-[--ink-3]"}>
                          Due {a.dueAt.toISOString().slice(0, 10)}
                        </span>
                      </>
                    )}
                    {isCompleted && a.completedAt && (
                      <>
                        <span aria-hidden>·</span>
                        <span className="text-[--ink-3]">
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
