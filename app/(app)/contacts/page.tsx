import { and, eq, ilike, gte, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Contact, Sequence } from "@/db/schema";
export type LastContactedMap = Record<number, string | null>;
import NewContactModal from "./new-contact-modal";
import CsvImportModal from "./csv-import-modal";
import ExportCsvButton from "./export-csv-button";
import ContactFilters from "./contact-filters";
import ContactsTable from "./contacts-table";

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-neutral-100">Contacts</h2>
          <p className="mt-1 text-sm text-neutral-400">Manage your leads and customers.</p>
        </div>
        <div className="flex items-center gap-3">
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
          <div className="flex flex-col items-center gap-3 px-5 py-16 text-center">
            <p className="text-sm text-neutral-400">
              {db
                ? hasActiveFilters
                  ? "No contacts match the current filters."
                  : "No contacts yet."
                : "Database not connected."}
            </p>
            <p className="text-xs text-neutral-600">
              {db
                ? hasActiveFilters
                  ? "Try adjusting or clearing the filters."
                  : "Click “New contact” to add your first contact."
                : "Set DATABASE_URL to connect your Neon database."}
            </p>
            {db && !hasActiveFilters && <NewContactModal hasDb={!!db} />}
          </div>
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
