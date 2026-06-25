import { and, count, eq, isNull, lt } from "drizzle-orm";
import { getDb, schema } from "@/db";
import AppShell from "@/components/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const db = getDb();
  let overdueCount = 0;
  let overdueTaskCount = 0;
  if (db) {
    const now = new Date();
    const [activityRows, taskRows] = await Promise.all([
      db
        .select({ c: count() })
        .from(schema.activities)
        .where(
          and(
            lt(schema.activities.dueAt, now),
            isNull(schema.activities.completedAt)
          )
        ),
      db
        .select({ c: count() })
        .from(schema.activities)
        .where(
          and(
            eq(schema.activities.type, "task"),
            lt(schema.activities.dueAt, now),
            isNull(schema.activities.completedAt)
          )
        ),
    ]);
    overdueCount = Number(activityRows[0].c);
    overdueTaskCount = Number(taskRows[0].c);
  }
  return <AppShell overdueCount={overdueCount} overdueTaskCount={overdueTaskCount}>{children}</AppShell>;
}
