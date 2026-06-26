import { and, count, eq, isNull, lt } from "drizzle-orm";
import { getDb, schema } from "@/db";
import AppShell from "@/components/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const db = getDb();
  let overdueCount = 0;
  let overdueTaskCount = 0;
  if (db) {
    // "Overdue" = due before the start of today (matches the dashboard agenda and
    // the Tasks page). Using `now` would mis-flag tasks due today (stored at
    // midnight) as overdue once the clock passes their due moment.
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const [activityRows, taskRows] = await Promise.all([
      db
        .select({ c: count() })
        .from(schema.activities)
        .where(
          and(
            lt(schema.activities.dueAt, todayStart),
            isNull(schema.activities.completedAt)
          )
        ),
      db
        .select({ c: count() })
        .from(schema.activities)
        .where(
          and(
            eq(schema.activities.type, "task"),
            lt(schema.activities.dueAt, todayStart),
            isNull(schema.activities.completedAt)
          )
        ),
    ]);
    overdueCount = Number(activityRows[0].c);
    overdueTaskCount = Number(taskRows[0].c);
  }
  return <AppShell overdueCount={overdueCount} overdueTaskCount={overdueTaskCount}>{children}</AppShell>;
}
