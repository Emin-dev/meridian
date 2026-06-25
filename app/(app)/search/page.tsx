import { getDb } from "@/db";
import { searchGlobal, type SearchResults } from "./actions";
import SearchResultsTabs from "./search-results";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string }>;
}) {
  const { q, tab } = await searchParams;
  const query = q?.trim() ?? "";
  const db = getDb();

  let results: SearchResults = { contacts: [], deals: [], activities: [], totals: { contacts: 0, deals: 0, activities: 0 } };
  if (db && query) {
    results = await searchGlobal(query);
  }

  const total =
    results.contacts.length + results.deals.length + results.activities.length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-neutral-100">Search</h2>
        <p className="mt-1 text-sm text-neutral-400">
          {query
            ? `${total} result${total !== 1 ? "s" : ""} for “${query}”`
            : "Search across contacts, deals and activities."}
        </p>
      </div>

      {!db ? (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-5 py-16 text-center">
          <p className="text-sm text-neutral-400">Database not connected.</p>
          <p className="mt-1 text-xs text-neutral-600">
            Set DATABASE_URL to connect your Neon database and enable search.
          </p>
        </div>
      ) : !query ? (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-5 py-16 text-center">
          <p className="text-sm text-neutral-400">No search query.</p>
          <p className="mt-1 text-xs text-neutral-600">
            Use the search bar to find contacts, deals and activities.
          </p>
        </div>
      ) : (
        <SearchResultsTabs results={results} query={query} initialTab={tab} />
      )}
    </div>
  );
}
