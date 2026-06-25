import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, asc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { SequenceStep } from "@/db/schema";
import { StepCard, AddStepForm } from "./step-card";

interface Props {
  params: Promise<{ id: string }>;
}

const STATUS_LABELS = {
  active: { label: "Active", className: "bg-emerald-500/10 text-emerald-400" },
  paused: { label: "Paused", className: "bg-neutral-700 text-neutral-400" },
} as const;

export default async function SequenceDetailPage({ params }: Props) {
  const { id } = await params;
  const numId = Number(id);

  if (!Number.isInteger(numId) || numId <= 0) notFound();

  const db = getDb();

  if (!db) {
    return (
      <div className="space-y-6">
        <Link
          href="/sequences"
          className="text-sm text-neutral-400 transition-colors hover:text-neutral-100"
        >
          ← Sequences
        </Link>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-6 py-16 text-center">
          <p className="text-sm text-neutral-400">Database not connected.</p>
          <p className="mt-1 text-xs text-neutral-600">
            Set{" "}
            <code className="rounded bg-neutral-800 px-1 py-0.5">
              DATABASE_URL
            </code>{" "}
            to connect your Neon database.
          </p>
        </div>
      </div>
    );
  }

  const [sequence] = await db
    .select()
    .from(schema.sequences)
    .where(eq(schema.sequences.id, numId))
    .limit(1);

  if (!sequence) notFound();

  const steps: SequenceStep[] = await db
    .select()
    .from(schema.sequenceSteps)
    .where(eq(schema.sequenceSteps.sequenceId, numId))
    .orderBy(asc(schema.sequenceSteps.position));

  const statusMeta = STATUS_LABELS[sequence.status];

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/sequences"
        className="text-sm text-neutral-400 transition-colors hover:text-neutral-100"
      >
        ← Sequences
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-neutral-100">
            {sequence.name}
          </h2>
          <div className="mt-2 flex items-center gap-2">
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusMeta.className}`}
            >
              {statusMeta.label}
            </span>
            <span className="text-xs text-neutral-500">
              {steps.length} {steps.length === 1 ? "step" : "steps"}
            </span>
          </div>
        </div>
        <div className="text-xs text-neutral-600">
          Created{" "}
          {sequence.createdAt.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </div>
      </div>

      {/* Steps */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium text-neutral-300">Steps</h3>
        </div>

        {steps.length === 0 ? (
          <div className="mb-4 rounded-xl border border-dashed border-neutral-800 bg-neutral-900/50 px-6 py-10 text-center">
            <p className="text-sm text-neutral-500">No steps yet.</p>
            <p className="mt-1 text-xs text-neutral-600">
              Add the first step to this sequence below.
            </p>
          </div>
        ) : (
          <div className="mb-4 space-y-3">
            {steps.map((step) => (
              <StepCard key={step.id} step={step} sequenceId={numId} />
            ))}
          </div>
        )}

        <AddStepForm sequenceId={numId} />
      </div>
    </div>
  );
}
