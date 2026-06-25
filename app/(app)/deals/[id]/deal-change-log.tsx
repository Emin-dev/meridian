import { eq, desc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { DealEvent } from "@/db/schema";

function formatTimestamp(date: Date): string {
  return (
    date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }) +
    " at " +
    date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  );
}

const FIELD_LABELS: Record<string, string> = {
  stage: "Stage",
  value: "Value",
};

function EventValue({ v }: { v: string | null }) {
  if (v === null || v === "") {
    return <em className="text-neutral-600 not-italic">—</em>;
  }
  return <>{v}</>;
}

interface Props {
  dealId: number;
}

export default async function DealChangeLog({ dealId }: Props) {
  const db = getDb();

  let events: DealEvent[] = [];
  if (db) {
    events = await db
      .select()
      .from(schema.dealEvents)
      .where(eq(schema.dealEvents.dealId, dealId))
      .orderBy(desc(schema.dealEvents.changedAt));
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-neutral-300">Change log</h3>

      {!db && (
        <p className="text-xs text-neutral-500">
          Connect a database to view change history.
        </p>
      )}

      {db && events.length === 0 && (
        <p className="py-3 text-center text-sm text-neutral-500">
          No field changes recorded yet.
        </p>
      )}

      {events.length > 0 && (
        <ul className="space-y-1.5">
          {events.map((e) => (
            <li
              key={e.id}
              className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-neutral-800/40 px-3 py-2 text-xs"
            >
              <span className="shrink-0 rounded bg-neutral-700 px-1.5 py-0.5 font-medium text-neutral-400">
                {FIELD_LABELS[e.field] ?? e.field}
              </span>
              <span className="text-neutral-500">
                <EventValue v={e.oldValue} />
              </span>
              <span className="text-neutral-600">→</span>
              <span className="font-medium text-neutral-200">
                <EventValue v={e.newValue} />
              </span>
              <span className="ml-auto shrink-0 whitespace-nowrap text-neutral-600">
                {formatTimestamp(e.changedAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
