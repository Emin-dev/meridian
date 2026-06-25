import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Example table — replace with your real domain model.
 * Run `pnpm db:push` to sync this schema to Neon.
 */
export const visits = pgTable("visits", {
  id: serial("id").primaryKey(),
  path: text("path").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
