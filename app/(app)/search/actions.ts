"use server";

import { or, ilike } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";

// Hard per-entity cap. `ilike('%term%')` can't use an index, so an unbounded
// match-count over a large connected DB is a full sequential scan that can blow
// the Vercel 10s budget. Bounding every query to this many rows keeps the work
// proportional to the cap, not the table size. Totals are derived from the
// capped result set; the UI shows `N+` when a bucket reaches the limit.
export const SEARCH_RESULT_LIMIT = 25;

// Bound the query length so empty/oversized inputs can't trigger needless
// ilike table scans (every char widens the LIKE pattern). Require at least
// two chars so a single-char term can't match nearly every row.
const querySchema = z.string().trim().min(2).max(120);

// Escape LIKE/ILIKE metacharacters so a user-supplied `%`, `_`, or backslash
// is matched literally instead of acting as a wildcard (which would turn the
// search into a far broader, surprising scan). Postgres LIKE's default ESCAPE
// is `\`, so escape the backslash itself too.
function escapeLikePattern(term: string): string {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}

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

  const q = `%${escapeLikePattern(parsed.data)}%`;

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

  const [contacts, deals, activities] = await Promise.all([
    db
      .select({
        id: schema.contacts.id,
        name: schema.contacts.name,
        email: schema.contacts.email,
        company: schema.contacts.company,
      })
      .from(schema.contacts)
      .where(contactsWhere)
      .limit(SEARCH_RESULT_LIMIT),
    db
      .select({
        id: schema.deals.id,
        title: schema.deals.title,
        stage: schema.deals.stage,
        value: schema.deals.value,
      })
      .from(schema.deals)
      .where(dealsWhere)
      .limit(SEARCH_RESULT_LIMIT),
    db
      .select({
        id: schema.activities.id,
        type: schema.activities.type,
        subject: schema.activities.subject,
        body: schema.activities.body,
      })
      .from(schema.activities)
      .where(activitiesWhere)
      .limit(SEARCH_RESULT_LIMIT),
  ]);

  return {
    contacts,
    deals,
    activities,
    totals: {
      contacts: contacts.length,
      deals: deals.length,
      activities: activities.length,
    },
  };
}
