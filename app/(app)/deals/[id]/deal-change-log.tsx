import { eq, desc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { DealEvent } from "@/db/schema";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { STAGE_LABELS } from "../stages";

const FIELD_LABELS: Record<string, string> = {
  stage: "Stage",
  value: "Value",
  probability: "Win probability",
};

// Turn a raw change-log value (decimal/percent string, stage key, or null) into
// a legible, human-formatted string so transitions like a null → set value read
// as "— → ₼1,000" instead of an ambiguous blank. Falls back to the raw value for
// anything unparseable so a bad row is still shown, never hidden.
function formatEventValue(
  field: string,
  v: string | null,
  currency: string,
): string | null {
  if (v === null || v === "") return null;
  if (field === "value") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? formatCurrency(n, currency) : v;
  }
  if (field === "probability") {
    const n = Number(v);
    return Number.isFinite(n) ? `${n}%` : v;
  }
  if (field === "stage") {
    return STAGE_LABELS[v] ?? v;
  }
  return v;
}

function EventValue({ value }: { value: string | null }) {
  if (value === null) {
    return <em className="text-[var(--ink-3)] not-italic">—</em>;
  }
  return <>{value}</>;
}

interface Props {
  dealId: number;
  /** Deal currency, used to format monetary `value` transitions in the log. */
  currency?: string;
}

export default async function DealChangeLog({ dealId, currency = "USD" }: Props) {
  const db = getDb();

  const LIMIT = 50;
  let events: DealEvent[] = [];
  let hasMore = false;
  if (db) {
    const rows = await db
      .select()
      .from(schema.dealEvents)
      .where(eq(schema.dealEvents.dealId, dealId))
      .orderBy(desc(schema.dealEvents.changedAt))
      .limit(LIMIT + 1);
    hasMore = rows.length > LIMIT;
    events = hasMore ? rows.slice(0, LIMIT) : rows;
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-[var(--ink-2)]">Change log</h3>

      {!db && (
        <p className="text-xs text-[var(--ink-3)]">
          Connect a database to view change history.
        </p>
      )}

      {db && events.length === 0 && (
        <p className="py-3 text-center text-sm text-[var(--ink-3)]">
          No field changes recorded yet.
        </p>
      )}

      {events.length > 0 && (
        <ul className="space-y-1.5">
          {events.map((e) => (
            <li
              key={e.id}
              className="rounded-lg bg-[var(--surface-2)] px-3 py-2.5 text-xs sm:flex sm:flex-wrap sm:items-center sm:gap-x-2 sm:gap-y-1 sm:py-2"
            >
              <span className="block w-fit shrink-0 rounded bg-[var(--surface-3)] px-1.5 py-0.5 font-medium text-[var(--ink-2)]">
                {FIELD_LABELS[e.field] ?? e.field}
              </span>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 sm:mt-0 sm:contents">
                <span className="text-[var(--ink-3)]">
                  <EventValue value={formatEventValue(e.field, e.oldValue, currency)} />
                </span>
                <span className="text-[var(--ink-3)]">→</span>
                <span className="font-medium text-[var(--ink-1)]">
                  <EventValue value={formatEventValue(e.field, e.newValue, currency)} />
                </span>
              </div>
              <span className="mt-1.5 block whitespace-nowrap text-[var(--ink-3)] sm:mt-0 sm:ml-auto sm:shrink-0">
                {formatDateTime(e.changedAt)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {hasMore && (
        <p className="pt-1 text-center text-xs text-[var(--ink-3)]">
          Showing latest {LIMIT} changes.
        </p>
      )}
    </div>
  );
}
