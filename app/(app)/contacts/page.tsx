import { and, eq, ilike, gte, isNull, inArray, sql, asc, desc, notExists } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Sequence } from "@/db/schema";
import type { LastContactedMap, ContactListItem } from "./types";
import NewContactModal from "./new-contact-modal";
import CsvImportModal from "./csv-import-modal";
import ExportCsvButton from "./export-csv-button";
import ContactFilters from "./contact-filters";
import SegmentChips from "./segment-chips";
import ContactsTable from "./contacts-table";
import ScoreAllUnscoredButton from "./score-all-unscored-button";
import FindDuplicatesButton from "./find-duplicates-button";
import ContactsOverflowMenu from "./contacts-overflow-menu";
import { EmptyState } from "@/components/empty-state";
import EmptyStateActions from "@/components/empty-state-actions";
import { resolvePageWindow, slicePageWindow } from "@/lib/pagination";

const UsersIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const FilterIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);

const VALID_SOURCES = ["website", "referral", "linkedin", "cold-outreach", "other"] as const;
type ContactSource = (typeof VALID_SOURCES)[number];

const VALID_STATUSES = ["lead", "active", "inactive", "churned"] as const;
type ContactStatus = (typeof VALID_STATUSES)[number];

const VALID_SORT_COLS = ["name", "company", "leadScore", "status", "createdAt"] as const;
type SortColKey = (typeof VALID_SORT_COLS)[number];

// Bound the contacts query so we never run an un-paginated full-table scan in
// the request path. "Load more" grows the visible window one page at a time.
const PAGE_SIZE = 50;
const MAX_PAGE = 100;

export const metadata = { title: "Contacts" };

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; company?: string; minScore?: string; source?: string; tag?: string; unscored?: string; noActivity?: string; sort?: string; dir?: string; view?: string; page?: string }>;
}) {
  const { status, company, minScore, source, tag, unscored, noActivity, sort, dir, view, page } = await searchParams;

  const statusFilter =
    status && (VALID_STATUSES as readonly string[]).includes(status)
      ? (status as ContactStatus)
      : undefined;
  const sourceFilter =
    source && (VALID_SOURCES as readonly string[]).includes(source)
      ? (source as ContactSource)
      : undefined;
  const companyFilter = company?.trim() || undefined;
  const minScoreFilter =
    minScore && !isNaN(parseInt(minScore)) ? parseInt(minScore) : undefined;
  const tagFilter = tag?.trim() || undefined;
  const unscoredFilter = unscored === "1";
  const noActivityDays =
    noActivity && !isNaN(parseInt(noActivity)) ? parseInt(noActivity) : undefined;

  const sortColKey: SortColKey =
    sort && (VALID_SORT_COLS as readonly string[]).includes(sort)
      ? (sort as SortColKey)
      : "createdAt";
  const sortDir = dir === "desc" ? "desc" : "asc";

  const { pageNum, windowSize, fetchLimit } = resolvePageWindow(page, {
    pageSize: PAGE_SIZE,
    maxPage: MAX_PAGE,
  });

  const db = getDb();

  let contacts: ContactListItem[] = [];
  let sequences: Sequence[] = [];
  let lastContactedMap: LastContactedMap = {};
  let hasMore = false;

  if (db) {
    // "No activity in N days" → keep contacts that have NO activity dated on or
    // after the cutoff. Done as a correlated NOT EXISTS so the DB filters rows
    // instead of transferring everything and filtering in JS.
    const noActivityCutoff =
      noActivityDays !== undefined
        ? new Date(Date.now() - noActivityDays * 24 * 60 * 60 * 1000)
        : undefined;

    const conditions: (SQL | undefined)[] = [
      statusFilter !== undefined
        ? eq(schema.contacts.status, statusFilter)
        : undefined,
      sourceFilter !== undefined
        ? eq(schema.contacts.source, sourceFilter)
        : undefined,
      companyFilter !== undefined
        ? ilike(schema.contacts.company, `%${companyFilter}%`)
        : undefined,
      minScoreFilter !== undefined
        ? gte(schema.contacts.leadScore, minScoreFilter)
        : undefined,
      tagFilter !== undefined
        ? sql`${schema.contacts.tags} @> ARRAY[${tagFilter}]::text[]`
        : undefined,
      unscoredFilter ? isNull(schema.contacts.leadScore) : undefined,
      noActivityCutoff !== undefined
        ? notExists(
            db
              .select({ one: sql`1` })
              .from(schema.activities)
              .where(
                and(
                  eq(schema.activities.contactId, schema.contacts.id),
                  gte(schema.activities.createdAt, noActivityCutoff),
                ),
              ),
          )
        : undefined,
    ];
    const whereClause = and(...conditions);

    const sortColExpr = {
      name: schema.contacts.name,
      company: schema.contacts.company,
      leadScore: schema.contacts.leadScore,
      status: schema.contacts.status,
      createdAt: schema.contacts.createdAt,
    }[sortColKey];
    const orderByExpr = sortDir === "desc" ? desc(sortColExpr) : asc(sortColExpr);

    // The active-sequence list is independent of which contacts are visible, so
    // kick it off now (eagerly, via .execute()) and let it run while we resolve
    // the contact rows — and then the activity aggregate.
    const sequencesPromise = db
      .select()
      .from(schema.sequences)
      .where(eq(schema.sequences.status, "active"))
      .orderBy(schema.sequences.name)
      .execute();

    const contactRows = await db
      .select({
        id: schema.contacts.id,
        name: schema.contacts.name,
        email: schema.contacts.email,
        phone: schema.contacts.phone,
        company: schema.contacts.company,
        title: schema.contacts.title,
        status: schema.contacts.status,
        source: schema.contacts.source,
        owner: schema.contacts.owner,
        tags: schema.contacts.tags,
        leadScore: schema.contacts.leadScore,
        createdAt: schema.contacts.createdAt,
      })
      .from(schema.contacts)
      .where(whereClause)
      .orderBy(orderByExpr)
      // Fetch one extra row to detect whether another page exists.
      .limit(fetchLimit);

    const sliced = slicePageWindow(contactRows, windowSize);
    contacts = sliced.rows;
    hasMore = sliced.hasMore;

    const visibleContactIds = contacts.map((c) => c.id);

    // The activity aggregate depends on the resolved contact ids, so it can only
    // start once contacts are in — but it then runs in parallel with the
    // still-in-flight sequence list. Skip the query when no contacts are visible.
    const [sequenceRows, activityRows] = await Promise.all([
      sequencesPromise,
      visibleContactIds.length > 0
        ? db
            .select({
              contactId: schema.activities.contactId,
              lastAt: sql<string | null>`max(${schema.activities.createdAt})`,
            })
            .from(schema.activities)
            .where(inArray(schema.activities.contactId, visibleContactIds))
            .groupBy(schema.activities.contactId)
        : Promise.resolve([]),
    ]);

    sequences = sequenceRows;

    for (const row of activityRows) {
      if (row.contactId != null) {
        lastContactedMap[row.contactId] = row.lastAt;
      }
    }
  }

  const hasActiveFilters = !!(
    statusFilter ||
    sourceFilter ||
    companyFilter ||
    minScoreFilter !== undefined ||
    tagFilter ||
    unscoredFilter ||
    noActivityDays !== undefined
  );

  const hasUnscored = contacts.some((c) => c.leadScore == null);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-title2 font-semibold text-[var(--ink-1)]">Contacts</h2>
          <p className="text-body mt-1 text-[var(--ink-2)]">Manage your leads and customers.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Secondary actions — visible on sm+ */}
          <div className="hidden sm:flex sm:items-center sm:gap-2">
            <ScoreAllUnscoredButton hasUnscored={hasUnscored} />
            <FindDuplicatesButton hasDb={!!db} />
            <ExportCsvButton
              hasDb={!!db}
              status={status}
              company={company}
              minScore={minScore}
              source={source}
              tag={tag}
              unscored={unscored}
              noActivity={noActivity}
            />
          </div>
          {/* Overflow menu — mobile only */}
          <ContactsOverflowMenu
            hasUnscored={hasUnscored}
            hasDb={!!db}
            status={status}
            company={company}
            minScore={minScore}
            source={source}
            tag={tag}
            unscored={unscored}
            noActivity={noActivity}
          />
          {/* Primary actions — always visible */}
          <CsvImportModal hasDb={!!db} />
          <NewContactModal hasDb={!!db} />
        </div>
      </div>

      {/* Segment preset chips */}
      <SegmentChips
        currentParams={{ status, company, minScore, source, tag, unscored, noActivity }}
      />

      {/* Filter bar */}
      <ContactFilters
        initialStatus={status ?? ""}
        initialCompany={company ?? ""}
        initialMinScore={minScore ?? ""}
        initialSource={source ?? ""}
        initialTag={tag ?? ""}
        initialSort={sortColKey}
        initialDir={sortDir}
      />

      {contacts.length === 0 ? (
        <div className="border-y border-[var(--line-1)] bg-[var(--surface-1)] sm:rounded-xl sm:border">
          <div className="flex items-center justify-between border-b border-[var(--line-1)] px-5 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--ink-3)]">
              {hasActiveFilters ? "Filtered contacts" : "All Contacts"}
            </p>
          </div>
          {!db ? (
            <EmptyState
              icon={<UsersIcon />}
              title="Database not connected"
              description="Set DATABASE_URL to connect your Neon database."
            />
          ) : hasActiveFilters ? (
            <EmptyState
              icon={<FilterIcon />}
              title="No contacts match your filters"
              description="Try adjusting or clearing the active filters."
              action={<EmptyStateActions clearFiltersHref="/contacts" />}
            />
          ) : (
            <EmptyState
              icon={<UsersIcon />}
              title="No contacts yet"
              description="Start building your CRM by adding your first contact."
              action={
                <EmptyStateActions
                  primaryAction={<NewContactModal hasDb={!!db} />}
                />
              }
            />
          )}
        </div>
      ) : (
        <ContactsTable
          contacts={contacts}
          sequences={sequences}
          hasActiveFilters={hasActiveFilters}
          lastContactedMap={lastContactedMap}
          hasDb
          sort={sortColKey}
          dir={sortDir}
          view={view === "cards" ? "cards" : "table"}
          page={pageNum}
          hasMore={hasMore}
          allSearchParams={{
            ...(status ? { status } : {}),
            ...(company ? { company } : {}),
            ...(minScore ? { minScore } : {}),
            ...(source ? { source } : {}),
            ...(tag ? { tag } : {}),
            ...(unscored ? { unscored } : {}),
            ...(noActivity ? { noActivity } : {}),
          }}
        />
      )}
    </div>
  );
}
