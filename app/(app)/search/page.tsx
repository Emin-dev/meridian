import { getDb } from "@/db";
import { searchGlobal, type SearchResults } from "./actions";
import SearchResultsTabs from "./search-results";

function parsePage(value: string | undefined): number {
  const n = value ? parseInt(value, 10) : 1;
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export const metadata = { title: "Search" };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    tab?: string;
    cp?: string;
    dp?: string;
    ap?: string;
  }>;
}) {
  const { q, tab, cp, dp, ap } = await searchParams;
  const query = q?.trim() ?? "";
  const db = getDb();

  const pages = {
    contacts: parsePage(cp),
    deals: parsePage(dp),
    activities: parsePage(ap),
  };

  let results: SearchResults = {
    contacts: [],
    deals: [],
    activities: [],
    hasMore: { contacts: false, deals: false, activities: false },
  };
  if (db && query) {
    results = await searchGlobal(query, pages);
  }

  const total =
    results.contacts.length + results.deals.length + results.activities.length;
  const hasMoreAny =
    results.hasMore.contacts ||
    results.hasMore.deals ||
    results.hasMore.activities;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-title2 font-semibold text-[var(--ink-1)]">Search</h2>
        <p className="mt-1 text-footnote text-[var(--ink-2)]">
          {query
            ? `${total}${hasMoreAny ? "+" : ""} result${total !== 1 ? "s" : ""} for "${query}"`
            : "Search across contacts, deals and activities."}
        </p>
      </div>

      {!db ? (
        <div className="card px-5 py-16 text-center">
          <p className="text-body text-[var(--ink-2)]">Database not connected.</p>
          <p className="mt-1 text-footnote text-[var(--ink-3)]">
            Set DATABASE_URL to connect your Neon database and enable search.
          </p>
        </div>
      ) : !query ? (
        <div className="card px-5 py-16 text-center">
          <p className="text-body text-[var(--ink-2)]">No search query.</p>
          <p className="mt-1 text-footnote text-[var(--ink-3)]">
            Use the search bar to find contacts, deals and activities.
          </p>
        </div>
      ) : (
        <SearchResultsTabs
          results={results}
          query={query}
          initialTab={tab}
          pages={pages}
        />
      )}
    </div>
  );
}
