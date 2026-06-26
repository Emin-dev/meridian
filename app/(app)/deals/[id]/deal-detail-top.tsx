"use client";

import { useState } from "react";
import type { Deal } from "@/db/schema";
import EditDealForm from "./edit-deal-form";
import StageControl from "../stage-control";

const STAGE_META = {
  lead:        { label: "Lead",        color: "text-[var(--ink-2)]", bg: "bg-[var(--surface-2)]"   },
  qualified:   { label: "Qualified",   color: "text-[var(--info)]",  bg: "bg-[var(--info-tint)]"   },
  proposal:    { label: "Proposal",    color: "text-[var(--accent)]", bg: "bg-[var(--accent-tint)]" },
  negotiation: { label: "Negotiation", color: "text-[var(--warn)]",  bg: "bg-[var(--warn-tint)]"   },
  won:         { label: "Won",         color: "text-[var(--ok)]",    bg: "bg-[var(--ok-tint)]"     },
  lost:        { label: "Lost",        color: "text-[var(--bad)]",   bg: "bg-[var(--bad-tint)]"    },
} as const;

function formatValue(value: string | null, currency: string) {
  if (!value) return null;
  const num = parseFloat(value);
  if (isNaN(num)) return null;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(num);
  } catch {
    // Invalid currency code → Intl throws RangeError; fall back, don't crash.
    return `${Math.round(num).toLocaleString("en-US")} ${currency}`;
  }
}

/** Fields that EditDealForm can update optimistically. */
export type DealFormUpdate = {
  title: string;
  /** Same union as Deal["stage"]. Typed as-is to avoid circular inference. */
  stage: Deal["stage"];
  value: string | null;
  expectedCloseDate: Date | null;
  probability: number;
};

interface Props {
  initialDeal: Deal;
  deleteButton: React.ReactNode;
}

export default function DealDetailTop({ initialDeal, deleteButton }: Props) {
  const [deal, setDeal] = useState(initialDeal);
  // Increment only on rollback so the form remounts with reverted defaultValues.
  const [formVersion, setFormVersion] = useState(0);

  const stageMeta =
    STAGE_META[deal.stage as keyof typeof STAGE_META] ??
    ({ label: deal.stage, color: "text-[var(--ink-2)]", bg: "bg-[var(--surface-2)]" } as const);
  const formatted = formatValue(deal.value, deal.currency);

  // ── Form callbacks ──────────────────────────────────────────────────────────

  function handleFormSaved(updates: DealFormUpdate) {
    // Apply optimistic update to the header without remounting the form.
    setDeal((prev) => ({
      ...prev,
      title:             updates.title,
      stage:             updates.stage,
      value:             updates.value,
      expectedCloseDate: updates.expectedCloseDate,
      probability:       updates.probability,
    }));
  }

  function handleFormRollback(snapshot: Deal) {
    // Server rejected the save — revert and remount the form with old defaultValues.
    setDeal(snapshot);
    setFormVersion((v) => v + 1);
  }

  // ── StageControl callbacks ──────────────────────────────────────────────────

  function handleStageOptimistic(newStage: string) {
    setDeal((prev) => ({ ...prev, stage: newStage as Deal["stage"] }));
  }

  function handleStageRollback(oldStage: string) {
    setDeal((prev) => ({ ...prev, stage: oldStage as Deal["stage"] }));
  }

  return (
    <>
      {/* ── Page header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-[var(--ink-1)] break-words">{deal.title}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${stageMeta.bg} ${stageMeta.color}`}
            >
              {stageMeta.label}
            </span>
            {formatted ? (
              <span className="text-sm font-semibold text-[var(--accent)]">{formatted}</span>
            ) : (
              <span className="text-xs text-[var(--ink-3)]">Not set</span>
            )}
            {deal.expectedCloseDate && (
              <span className="text-xs text-[var(--ink-3)]">
                Close:{" "}
                {new Date(deal.expectedCloseDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            )}
          </div>
          {(deal.stage === "won" || deal.stage === "lost") && deal.closeReason && (
            <p className="mt-1.5 text-xs text-[var(--ink-2)]">
              <span className="text-[var(--ink-3)]">Reason: </span>
              {deal.closeReason}
            </p>
          )}
          <StageControl
            dealId={deal.id}
            stage={deal.stage}
            onOptimisticMove={handleStageOptimistic}
            onMoveRollback={handleStageRollback}
          />
        </div>
        {deleteButton}
      </div>

      {/* ── Edit deal details card ────────────────────────────────────────────── */}
      <div className="rounded-xl border border-[var(--line-1)] bg-[var(--surface-1)] p-4 sm:p-5">
        <h3 className="mb-4 text-sm font-medium text-[var(--ink-2)]">Details</h3>
        <EditDealForm
          key={formVersion}
          deal={deal}
          onSaved={handleFormSaved}
          onRollback={handleFormRollback}
        />
        <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-3 border-t border-[var(--line-1)] pt-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-[var(--ink-3)]">Created</dt>
            <dd className="mt-0.5 text-[var(--ink-1)]">
              {initialDeal.createdAt.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--ink-3)]">Last updated</dt>
            <dd className="mt-0.5 text-[var(--ink-1)]">
              {initialDeal.updatedAt.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </dd>
          </div>
        </dl>
      </div>
    </>
  );
}
