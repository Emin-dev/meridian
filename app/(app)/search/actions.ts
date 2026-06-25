"use server";

import { or, ilike } from "drizzle-orm";
import { getDb, schema } from "@/db";

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
};

export async function searchGlobal(query: string): Promise<SearchResults> {
  const db = getDb();
  if (!db || !query.trim()) {
    return { contacts: [], deals: [], activities: [] };
  }

  const q = `%${query.trim()}%`;

  const [contacts, deals, activities] = await Promise.all([
    db
      .select({
        id: schema.contacts.id,
        name: schema.contacts.name,
        email: schema.contacts.email,
        company: schema.contacts.company,
      })
      .from(schema.contacts)
      .where(
        or(
          ilike(schema.contacts.name, q),
          ilike(schema.contacts.email, q),
          ilike(schema.contacts.company, q),
        )
      )
      .limit(5),
    db
      .select({
        id: schema.deals.id,
        title: schema.deals.title,
        stage: schema.deals.stage,
        value: schema.deals.value,
      })
      .from(schema.deals)
      .where(ilike(schema.deals.title, q))
      .limit(5),
    db
      .select({
        id: schema.activities.id,
        type: schema.activities.type,
        subject: schema.activities.subject,
        body: schema.activities.body,
      })
      .from(schema.activities)
      .where(
        or(
          ilike(schema.activities.subject, q),
          ilike(schema.activities.body, q),
        )
      )
      .limit(5),
  ]);

  return { contacts, deals, activities };
}
