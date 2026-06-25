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

export const contactStatusEnum = pgEnum("contact_status", [
  "lead",
  "active",
  "inactive",
  "churned",
]);

export const contactSourceEnum = pgEnum("contact_source", [
  "website",
  "referral",
  "linkedin",
  "cold-outreach",
  "other",
]);

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

// ─── Contacts ─────────────────────────────────────────────────────────────────

export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  company: text("company"),
  title: text("title"),
  notes: text("notes"),
  status: contactStatusEnum("status").default("lead"),
  source: contactSourceEnum("source"),
  owner: text("owner"),
  tags: text("tags").array().notNull().default([]),
  leadScore: integer("lead_score"),
  leadScoreRationale: text("lead_score_rationale"),
  leadScoredAt: timestamp("lead_scored_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const contactsRelations = relations(contacts, ({ many }) => ({
  deals: many(deals),
  activities: many(activities),
  enrollments: many(contactSequenceEnrollments),
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
  closeReason: text("close_reason"),
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

// ─── Sequences ────────────────────────────────────────────────────────────────

export const sequenceStatusEnum = pgEnum("sequence_status", ["active", "paused"]);

export const sequences = pgTable("sequences", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  status: sequenceStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const sequencesRelations = relations(sequences, ({ many }) => ({
  steps: many(sequenceSteps),
  enrollments: many(contactSequenceEnrollments),
}));

export type Sequence = InferSelectModel<typeof sequences>;
export type NewSequence = InferInsertModel<typeof sequences>;

// ─── Sequence Steps ───────────────────────────────────────────────────────────

export const sequenceSteps = pgTable("sequence_steps", {
  id: serial("id").primaryKey(),
  sequenceId: integer("sequence_id")
    .notNull()
    .references(() => sequences.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  delayDays: integer("delay_days").notNull().default(0),
  subjectTemplate: text("subject_template").notNull(),
  bodyTemplate: text("body_template").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const sequenceStepsRelations = relations(sequenceSteps, ({ one }) => ({
  sequence: one(sequences, { fields: [sequenceSteps.sequenceId], references: [sequences.id] }),
}));

export type SequenceStep = InferSelectModel<typeof sequenceSteps>;
export type NewSequenceStep = InferInsertModel<typeof sequenceSteps>;

// ─── Contact Sequence Enrollments ─────────────────────────────────────────────

export const enrollmentStatusEnum = pgEnum("enrollment_status", [
  "active",
  "cancelled",
]);

export const contactSequenceEnrollments = pgTable(
  "contact_sequence_enrollments",
  {
    id: serial("id").primaryKey(),
    contactId: integer("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    sequenceId: integer("sequence_id")
      .notNull()
      .references(() => sequences.id, { onDelete: "cascade" }),
    enrolledAt: timestamp("enrolled_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    status: enrollmentStatusEnum("status").notNull().default("active"),
  }
);

export const contactSequenceEnrollmentsRelations = relations(
  contactSequenceEnrollments,
  ({ one }) => ({
    contact: one(contacts, {
      fields: [contactSequenceEnrollments.contactId],
      references: [contacts.id],
    }),
    sequence: one(sequences, {
      fields: [contactSequenceEnrollments.sequenceId],
      references: [sequences.id],
    }),
  })
);

export type ContactSequenceEnrollment = InferSelectModel<
  typeof contactSequenceEnrollments
>;
export type NewContactSequenceEnrollment = InferInsertModel<
  typeof contactSequenceEnrollments
>;
