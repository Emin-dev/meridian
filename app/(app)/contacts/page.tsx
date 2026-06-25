import { and, eq, ilike, gte, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import Link from "next/link";
import { getDb, schema } from "@/db";
import type { Contact, Sequence } from "@/db/schema";
export type LastContactedMap = Record<number, string | null>;
import NewContactModal from "./new-contact-modal";
import CsvImportModal from "./csv-import-modal";
import ExportCsvButton from "./export-csv-button";
import ContactFilters from "./contact-filters";
import ContactsTable from "./contacts-table";
import ScoreAllUnscoredButton from "./score-all-unscored-button";
import FindDuplicatesButton from "./find-duplicates-button";
import { EmptyState } from "@/components/empty-state";
import { DemoDataButton } from "@/components/demo-data-button";

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

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; company?: string; minScore?: string; source?: string; tag?: string }>;
}) {
  const { status, company, minScore, source, tag } = await searchParams;

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

  const db = getDb();

  let contacts: Contact[] = [];
  let sequences: Sequence[] = [];
  let lastContactedMap: LastContactedMap = {};

  if (db) {
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
    ];
    const whereClause = and(...conditions);

    const [contactRows, sequenceRows, activityRows] = await Promise.all([
      db
        .select()
        .from(schema.contacts)
        .where(whereClause)
        .orderBy(schema.contacts.createdAt),
      db
        .select()
        .from(schema.sequences)
        .where(eq(schema.sequences.status, "active"))
        .orderBy(schema.sequences.name),
      db
        .select({
          contactId: schema.activities.contactId,
          lastAt: sql<string | null>`max(${schema.activities.createdAt})`,
        })
        .from(schema.activities)
        .groupBy(schema.activities.contactId),
    ]);

    contacts = contactRows;
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
    tagFilter
  );

  const hasUnscored = contacts.some((c) => c.leadScore == null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-neutral-100">Contacts</h2>
          <p className="mt-1 text-sm text-neutral-400">Manage your leads and customers.</p>
        </div>
        <div className="flex items-center gap-3">
          <ScoreAllUnscoredButton hasUnscored={hasUnscored} />
          <FindDuplicatesButton hasDb={!!db} />
          <ExportCsvButton
            hasDb={!!db}
            status={status}
            company={company}
            minScore={minScore}
            source={source}
            tag={tag}
          />
          <CsvImportModal hasDb={!!db} />
          <NewContactModal hasDb={!!db} />
        </div>
      </div>

      {/* Filter bar */}
      <ContactFilters
        initialStatus={status ?? ""}
        initialCompany={company ?? ""}
        initialMinScore={minScore ?? ""}
        initialSource={source ?? ""}
        initialTag={tag ?? ""}
      />

      {contacts.length === 0 ? (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900">
          <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
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
              action={
                <Link
                  href="/contacts"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-300 transition-colors hover:bg-neutral-700 hover:text-neutral-100"
                >
                  Clear filters
                </Link>
              }
            />
          ) : (
            <EmptyState
              icon={<UsersIcon />}
              title="No contacts yet"
              description="Start building your CRM by adding your first contact."
              action={
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <NewContactModal hasDb={!!db} />
                  <DemoDataButton
                    label="Load demo data"
                    className="inline-flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-400 transition-colors hover:bg-neutral-700 hover:text-neutral-200 disabled:opacity-50"
                  />
                </div>
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
        />
      )}
    </div>
  );
}
