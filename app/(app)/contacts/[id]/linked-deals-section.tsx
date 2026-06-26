import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getCrmSettings } from "@/lib/settings";
import DealModal from "@/app/(app)/deals/deal-modal";

interface Props {
  contactId: number;
  contactName: string;
}

const STAGE_STYLES: Record<string, string> = {
  lead: "bg-blue-500/15 text-blue-400",
  qualified: "bg-violet-500/15 text-violet-400",
  proposal: "bg-yellow-500/15 text-yellow-400",
  negotiation: "bg-orange-500/15 text-orange-400",
  won: "bg-green-500/15 text-green-400",
  lost: "bg-red-500/15 text-red-400",
};

function fmtValue(value: string | null, currency: string) {
  if (!value) return null;
  const num = parseFloat(value);
  if (isNaN(num)) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(num);
}

export default async function LinkedDealsSection({
  contactId,
  contactName,
}: Props) {
  const db = getDb();

  type DealRow = {
    id: number;
    title: string;
    stage: string;
    value: string | null;
    currency: string;
    expectedCloseDate: Date | null;
  };

  let deals: DealRow[] = [];

  const settings = await getCrmSettings();

  if (db) {
    deals = await db
      .select({
        id: schema.deals.id,
        title: schema.deals.title,
        stage: schema.deals.stage,
        value: schema.deals.value,
        currency: schema.deals.currency,
        expectedCloseDate: schema.deals.expectedCloseDate,
      })
      .from(schema.deals)
      .where(eq(schema.deals.contactId, contactId))
      .orderBy(asc(schema.deals.createdAt));
  }

  // A deal created from a contact's page belongs to that contact, so the
  // modal's contact dropdown only needs this one contact — no full-table read.
  const contacts = [{ id: contactId, name: contactName }];

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-neutral-300">
          Deals
          {deals.length > 0 && (
            <span className="ml-2 rounded-full bg-neutral-800 px-1.5 py-0.5 text-xs font-normal text-neutral-500">
              {deals.length}
            </span>
          )}
        </h3>
        <DealModal
          hasDb={!!db}
          contacts={contacts}
          defaultContactId={contactId}
          defaultCurrency={settings.defaultCurrency}
          defaultStage={settings.defaultDealStage}
          buttonLabel="New Deal"
        />
      </div>

      {!db ? (
        <p className="text-sm text-neutral-500">Connect a database to view deals.</p>
      ) : deals.length === 0 ? (
        <p className="text-sm text-neutral-500">No deals linked to this contact yet.</p>
      ) : (
        <ul className="space-y-2">
          {deals.map((deal) => {
            const formatted = fmtValue(deal.value, deal.currency);
            const closeStr = deal.expectedCloseDate
              ? new Date(deal.expectedCloseDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : null;
            return (
              <li
                key={deal.id}
                className="flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-800/50 px-4 py-3"
              >
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                    STAGE_STYLES[deal.stage] ?? "bg-neutral-700 text-neutral-400"
                  }`}
                >
                  {deal.stage}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-sm text-neutral-200">{deal.title}</span>
                  <div className="flex gap-3 text-xs text-neutral-500">
                    {formatted && <span>{formatted}</span>}
                    {closeStr && <span>Close: {closeStr}</span>}
                  </div>
                </div>
                <Link
                  href={`/deals/${deal.id}`}
                  className="shrink-0 text-xs text-neutral-600 transition-colors hover:text-indigo-400"
                >
                  View →
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
