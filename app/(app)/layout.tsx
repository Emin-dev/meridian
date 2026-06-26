import { and, count, isNull, lt, sql } from "drizzle-orm";
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
    // One round-trip: the partial `activities_overdue_idx` (dueAt where
    // completedAt IS NULL) serves the outer WHERE, and a count() FILTER
    // narrows the same scanned rows to the task subset.
    const [row] = await db
      .select({
        overdue: count(),
        overdueTask: sql<number>`count(*) filter (where ${schema.activities.type} = 'task')`,
      })
      .from(schema.activities)
      .where(
        and(
          lt(schema.activities.dueAt, todayStart),
          isNull(schema.activities.completedAt)
        )
      );
    overdueCount = Number(row.overdue);
    overdueTaskCount = Number(row.overdueTask);
  }
  return <AppShell overdueCount={overdueCount} overdueTaskCount={overdueTaskCount}>{children}</AppShell>;
}
