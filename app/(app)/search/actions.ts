"use server";

import { or, ilike, count } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";

// Bound the query length so empty/oversized inputs can't trigger needless
// ilike table scans (every char widens the LIKE pattern).
const querySchema = z.string().trim().min(1).max(500);

const EMPTY_RESULTS: SearchResults = {
  contacts: [],
  deals: [],
  activities: [],
  totals: { contacts: 0, deals: 0, activities: 0 },
};

export type SearchResults = {
  contacts: Array<{
    id: number;
    name: string;
    email: string | null;
    company: string | null;
  }>;
  deals: Array<{
    id: number;
    title: string;
    stage: string;
    value: string | null;
  }>;
  activities: Array<{
    id: number;
    type: string;
    subject: string;
    body: string | null;
  }>;
  totals: {
    contacts: number;
    deals: number;
    activities: number;
  };
};

export async function searchGlobal(query: string): Promise<SearchResults> {
  const db = getDb();
  const parsed = querySchema.safeParse(query);
  if (!db || !parsed.success) {
    return EMPTY_RESULTS;
  }

  const q = `%${parsed.data}%`;

  const contactsWhere = or(
    ilike(schema.contacts.name, q),
    ilike(schema.contacts.email, q),
    ilike(schema.contacts.company, q),
  );
  const dealsWhere = ilike(schema.deals.title, q);
  const activitiesWhere = or(
    ilike(schema.activities.subject, q),
    ilike(schema.activities.body, q),
  );

  const [contacts, contactsCount, deals, dealsCount, activities, activitiesCount] =
    await Promise.all([
      db
        .select({
          id: schema.contacts.id,
          name: schema.contacts.name,
          email: schema.contacts.email,
          company: schema.contacts.company,
        })
        .from(schema.contacts)
        .where(contactsWhere)
        .limit(5),
      db.select({ count: count() }).from(schema.contacts).where(contactsWhere),
      db
        .select({
          id: schema.deals.id,
          title: schema.deals.title,
          stage: schema.deals.stage,
          value: schema.deals.value,
        })
        .from(schema.deals)
        .where(dealsWhere)
        .limit(5),
      db.select({ count: count() }).from(schema.deals).where(dealsWhere),
      db
        .select({
          id: schema.activities.id,
          type: schema.activities.type,
          subject: schema.activities.subject,
          body: schema.activities.body,
        })
        .from(schema.activities)
        .where(activitiesWhere)
        .limit(5),
      db.select({ count: count() }).from(schema.activities).where(activitiesWhere),
    ]);

  return {
    contacts,
    deals,
    activities,
    totals: {
      contacts: Number(contactsCount[0]?.count ?? contacts.length),
      deals: Number(dealsCount[0]?.count ?? deals.length),
      activities: Number(activitiesCount[0]?.count ?? activities.length),
    },
  };
}
