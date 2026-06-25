import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Sequence } from "@/db/schema";

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-emerald-500/10 text-emerald-400" },
  paused: { label: "Paused", className: "bg-neutral-700 text-neutral-400" },
};

export default async function SequencesPage() {
  const db = getDb();

  let sequences: Sequence[] = [];
  let stepCounts: Map<number, number> = new Map();

  if (db) {
    sequences = await db
      .select()
      .from(schema.sequences)
      .orderBy(desc(schema.sequences.createdAt));

    if (sequences.length > 0) {
      const steps = await db
        .select({
          sequenceId: schema.sequenceSteps.sequenceId,
        })
        .from(schema.sequenceSteps);

      for (const step of steps) {
        stepCounts.set(step.sequenceId, (stepCounts.get(step.sequenceId) ?? 0) + 1);
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-neutral-100">Sequences</h2>
          <p className="mt-1 text-sm text-neutral-400">
            Automated email sequences for outreach campaigns.
          </p>
        </div>
        <Link
          href="/sequences/new"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
        >
          New sequence
        </Link>
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-900">
        <div className="border-b border-neutral-800 px-5 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            All Sequences
          </p>
        </div>

        {sequences.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-5 py-16 text-center">
            <p className="text-sm text-neutral-400">
              {db ? "No sequences yet." : "Database not connected."}
            </p>
            <p className="text-xs text-neutral-600">
              {db
                ? 'Click "New sequence" to create your first email sequence.'
                : "Set DATABASE_URL to connect your Neon database."}
            </p>
            {db && (
              <Link
                href="/sequences/new"
                className="mt-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
              >
                New sequence
              </Link>
            )}
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
                    Steps
                  </th>
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody>
                {sequences.map((seq) => {
                  const statusMeta = STATUS_LABELS[seq.status];
                  const count = stepCounts.get(seq.id) ?? 0;
                  return (
                    <tr
                      key={seq.id}
                      className="border-b border-neutral-800 last:border-0 transition-colors hover:bg-neutral-800/40"
                    >
                      <td className="px-5 py-3 font-medium text-neutral-100">
                        {seq.name}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusMeta.className}`}
                        >
                          {statusMeta.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-neutral-400">
                        {count} {count === 1 ? "step" : "steps"}
                      </td>
                      <td className="px-5 py-3 text-neutral-400">
                        {seq.createdAt.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
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
