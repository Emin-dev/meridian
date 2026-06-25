import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  numeric,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const dealStageEnum = pgEnum("deal_stage", [
  "lead",
  "qualified",
  "proposal",
  "negotiation",
  "won",
  "lost",
]);

export const activityTypeEnum = pgEnum("activity_type", [
  "call",
  "email",
  "meeting",
  "note",
  "task",
]);

// ─── Contacts ─────────────────────────────────────────────────────────────────

export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  company: text("company"),
  title: text("title"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const contactsRelations = relations(contacts, ({ many }) => ({
  deals: many(deals),
  activities: many(activities),
}));

export type Contact = InferSelectModel<typeof contacts>;
export type NewContact = InferInsertModel<typeof contacts>;

// ─── Deals ────────────────────────────────────────────────────────────────────

export const deals = pgTable("deals", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  stage: dealStageEnum("stage").notNull().default("lead"),
  value: numeric("value", { precision: 12, scale: 2 }),
  currency: text("currency").notNull().default("USD"),
  contactId: integer("contact_id").references(() => contacts.id, { onDelete: "set null" }),
  expectedCloseDate: timestamp("expected_close_date", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const dealsRelations = relations(deals, ({ one, many }) => ({
  contact: one(contacts, { fields: [deals.contactId], references: [contacts.id] }),
  activities: many(activities),
}));

export type Deal = InferSelectModel<typeof deals>;
export type NewDeal = InferInsertModel<typeof deals>;

// ─── Activities ───────────────────────────────────────────────────────────────

export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  type: activityTypeEnum("type").notNull(),
  subject: text("subject").notNull(),
  body: text("body"),
  contactId: integer("contact_id").references(() => contacts.id, { onDelete: "cascade" }),
  dealId: integer("deal_id").references(() => deals.id, { onDelete: "cascade" }),
  dueAt: timestamp("due_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const activitiesRelations = relations(activities, ({ one }) => ({
  contact: one(contacts, { fields: [activities.contactId], references: [contacts.id] }),
  deal: one(deals, { fields: [activities.dealId], references: [deals.id] }),
}));

export type Activity = InferSelectModel<typeof activities>;
export type NewActivity = InferInsertModel<typeof activities>;
