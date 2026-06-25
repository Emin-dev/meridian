import Link from "next/link";
import { and, eq, ilike, gte, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Contact } from "@/db/schema";
import NewContactModal from "./new-contact-modal";
import CsvImportModal from "./csv-import-modal";
import LeadScoreBadge from "./lead-score-badge";
import ContactFilters from "./contact-filters";
import { tagColor } from "./tag-color";

const SOURCE_LABELS: Record<string, string> = {
  website: "Website",
  referral: "Referral",
  linkedin: "LinkedIn",
  "cold-outreach": "Cold Outreach",
  other: "Other",
};

const VALID_SOURCES = ["website", "referral", "linkedin", "cold-outreach", "other"] as const;
type ContactSource = (typeof VALID_SOURCES)[number];

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  lead: { label: "Lead", className: "bg-blue-500/10 text-blue-400" },
  active: { label: "Active", className: "bg-emerald-500/10 text-emerald-400" },
  inactive: { label: "Inactive", className: "bg-neutral-700 text-neutral-400" },
  churned: { label: "Churned", className: "bg-red-500/10 text-red-400" },
};

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
    contacts = await db
      .select()
      .from(schema.contacts)
      .where(whereClause)
      .orderBy(schema.contacts.createdAt);
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

      <div className="rounded-xl border border-neutral-800 bg-neutral-900">
        <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            {hasActiveFilters ? "Filtered contacts" : "All Contacts"}
          </p>
          {hasActiveFilters && (
            <span className="text-xs text-neutral-500">
              {contacts.length} result{contacts.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {contacts.length === 0 ? (
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
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-800 text-left">
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Name
                  </th>
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Status
                  </th>
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Email
                  </th>
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Phone
                  </th>
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Company
                  </th>
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Title
                  </th>
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Source
                  </th>
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Owner
                  </th>
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Score
                  </th>
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Tags
                  </th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => {
                  const statusMeta = c.status ? STATUS_LABELS[c.status] : null;
                  return (
                    <tr
                      key={c.id}
                      className="border-b border-neutral-800 last:border-0 transition-colors hover:bg-neutral-800/40"
                    >
                      <td className="px-5 py-3 font-medium text-neutral-100">
                        <Link
                          href={`/contacts/${c.id}`}
                          className="hover:text-indigo-400 transition-colors"
                        >
                          {c.name}
                        </Link>
                      </td>
                      <td className="px-5 py-3">
                        {statusMeta ? (
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusMeta.className}`}
                          >
                            {statusMeta.label}
                          </span>
                        ) : (
                          <span className="text-neutral-600">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-neutral-400">{c.email ?? "—"}</td>
                      <td className="px-5 py-3 text-neutral-400">{c.phone ?? "—"}</td>
                      <td className="px-5 py-3 text-neutral-400">{c.company ?? "—"}</td>
                      <td className="px-5 py-3 text-neutral-400">{c.title ?? "—"}</td>
                      <td className="px-5 py-3 text-neutral-400">
                        {c.source ? SOURCE_LABELS[c.source] ?? c.source : "—"}
                      </td>
                      <td className="px-5 py-3 text-neutral-400">{c.owner ?? "—"}</td>
                      <td className="px-5 py-3">
                        {c.leadScore != null ? (
                          <LeadScoreBadge score={c.leadScore} />
                        ) : (
                          <span className="text-neutral-600">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {(c.tags ?? []).length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {(c.tags ?? []).map((t) => (
                              <span
                                key={t}
                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${tagColor(t)}`}
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-neutral-600">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
