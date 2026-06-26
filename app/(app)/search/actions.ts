"use server";

import { or, ilike } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { requireSession } from "@/lib/require-session";
import { SEARCH_PAGE_SIZE, SEARCH_MAX_PAGE } from "./constants";

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
  hasMore: { contacts: false, deals: false, activities: false },
};

export type SearchPages = {
  contacts: number;
  deals: number;
  activities: number;
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
  // True for a tab when more matches exist beyond the rows returned, so the UI
  // can offer "Load more" instead of silently dropping the remainder.
  hasMore: {
    contacts: boolean;
    deals: boolean;
    activities: boolean;
  };
};

// Clamp a per-tab page number to [1, SEARCH_MAX_PAGE] so a crafted URL param
// can't request an unbounded window.
function clampPage(page: number): number {
  if (!Number.isFinite(page)) return 1;
  return Math.min(Math.max(Math.trunc(page), 1), SEARCH_MAX_PAGE);
}

export async function searchGlobal(
  query: string,
  pages: SearchPages = { contacts: 1, deals: 1, activities: 1 },
): Promise<SearchResults> {
  await requireSession();

  const db = getDb();
  const parsed = querySchema.safeParse(query);
  if (!db || !parsed.success) {
    return EMPTY_RESULTS;
  }

  const q = `%${escapeLikePattern(parsed.data)}%`;

  // Each tab fetches one extra row past its window to detect a further page.
  const contactsWindow = clampPage(pages.contacts) * SEARCH_PAGE_SIZE;
  const dealsWindow = clampPage(pages.deals) * SEARCH_PAGE_SIZE;
  const activitiesWindow = clampPage(pages.activities) * SEARCH_PAGE_SIZE;

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

  const [contactRows, dealRows, activityRows] = await Promise.all([
    db
      .select({
        id: schema.contacts.id,
        name: schema.contacts.name,
        email: schema.contacts.email,
        company: schema.contacts.company,
      })
      .from(schema.contacts)
      .where(contactsWhere)
      .limit(contactsWindow + 1),
    db
      .select({
        id: schema.deals.id,
        title: schema.deals.title,
        stage: schema.deals.stage,
        value: schema.deals.value,
      })
      .from(schema.deals)
      .where(dealsWhere)
      .limit(dealsWindow + 1),
    db
      .select({
        id: schema.activities.id,
        type: schema.activities.type,
        subject: schema.activities.subject,
        body: schema.activities.body,
      })
      .from(schema.activities)
      .where(activitiesWhere)
      .limit(activitiesWindow + 1),
  ]);

  return {
    contacts: contactRows.slice(0, contactsWindow),
    deals: dealRows.slice(0, dealsWindow),
    activities: activityRows.slice(0, activitiesWindow),
    hasMore: {
      contacts: contactRows.length > contactsWindow,
      deals: dealRows.length > dealsWindow,
      activities: activityRows.length > activitiesWindow,
    },
  };
}
