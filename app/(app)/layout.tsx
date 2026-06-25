import { and, isNull, lt } from "drizzle-orm";
import { getDb, schema } from "@/db";
import AppShell from "@/components/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const db = getDb();
  let overdueCount = 0;
  if (db) {
    const now = new Date();
    const rows = await db
      .select({ id: schema.activities.id })
      .from(schema.activities)
      .where(
        and(
          lt(schema.activities.dueAt, now),
          isNull(schema.activities.completedAt)
        )
      );
    overdueCount = rows.length;
  }
  return <AppShell overdueCount={overdueCount}>{children}</AppShell>;
}
