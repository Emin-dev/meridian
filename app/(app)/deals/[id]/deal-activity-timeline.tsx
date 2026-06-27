import { eq, desc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Activity } from "@/db/schema";
import InlineActivityForm from "@/app/(app)/contacts/[id]/inline-activity-form";
import ActivityToggle from "@/app/(app)/activity/activity-toggle";
import ActivityUndoButton from "@/app/(app)/activity/activity-undo-button";
import ActivityDeleteButton from "@/app/(app)/activity/activity-delete-button";

function formatCompletedAt(date: Date): string {
  const dateStr = date.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  const timeStr = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${dateStr} at ${timeStr}`;
}

type ActivityType = Activity["type"];

const TYPE_META: Record<
  ActivityType,
  { label: string; color: string; bg: string }
> = {
  call: { label: "Call", color: "text-[var(--info)]", bg: "bg-[var(--info-tint)]" },
  email: { label: "Email", color: "text-[var(--accent)]", bg: "bg-[var(--accent-tint)]" },
  meeting: {
    label: "Meeting",
    color: "text-[var(--ok)]",
    bg: "bg-[var(--ok-tint)]",
  },
  note: { label: "Note", color: "text-[var(--warn)]", bg: "bg-[var(--warn-tint)]" },
  task: { label: "Task", color: "text-[var(--accent)]", bg: "bg-[var(--accent-tint)]" },
};

interface Props {
  dealId: number;
}

export default async function DealActivityTimeline({ dealId }: Props) {
  const db = getDb();

  const LIMIT = 50;
  let activities: Activity[] = [];
  let hasMore = false;
  if (db) {
    const rows = await db
      .select()
      .from(schema.activities)
      .where(eq(schema.activities.dealId, dealId))
      .orderBy(desc(schema.activities.createdAt))
      .limit(LIMIT + 1);
    hasMore = rows.length > LIMIT;
    activities = hasMore ? rows.slice(0, LIMIT) : rows;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-[var(--ink-2)]">Activity timeline</h3>
        {db && <InlineActivityForm dealId={dealId} />}
      </div>

      {!db && (
        <p className="text-xs text-[var(--ink-3)]">
          Connect a database to log and view activities.
        </p>
      )}

      {db && activities.length === 0 && (
        <p className="py-4 text-center text-sm text-[var(--ink-3)]">
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
                className="flex gap-3 rounded-lg border border-[var(--line-1)] bg-[var(--surface-1)] px-4 py-3"
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
                  <p className={`text-sm font-medium ${isCompleted ? "text-[var(--ink-3)] line-through" : "text-[var(--ink-1)]"}`}>
                    {a.subject}
                  </p>
                  {a.body && (
                    <p className={`mt-0.5 line-clamp-2 text-xs ${isCompleted ? "text-[var(--ink-3)]" : "text-[var(--ink-2)]"}`}>
                      {a.body}
                    </p>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--ink-3)]">
                    <span>{date}</span>
                    {a.dueAt && (
                      <>
                        <span aria-hidden>·</span>
                        <span className={isOverdue ? "text-[var(--warn)]" : "text-[var(--ink-3)]"}>
                          Due {a.dueAt.toISOString().slice(0, 10)}
                        </span>
                      </>
                    )}
                    {isCompleted && a.completedAt && (
                      <>
                        <span aria-hidden>·</span>
                        <span className="text-[var(--ink-3)]">
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
                    <span aria-hidden>·</span>
                    <ActivityDeleteButton
                      activityId={a.id}
                      contactId={a.contactId}
                      dealId={a.dealId}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {hasMore && (
        <p className="pt-1 text-center text-xs text-[var(--ink-3)]">
          Showing latest {LIMIT} activities.
        </p>
      )}
    </div>
  );
}
