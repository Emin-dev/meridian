"use client";

import { useState } from "react";
import type { Deal } from "@/db/schema";
import EditDealForm from "./edit-deal-form";
import StageControl from "../stage-control";

const STAGE_META = {
  lead:        { label: "Lead",        color: "text-blue-400",   bg: "bg-blue-900/20"   },
  qualified:   { label: "Qualified",   color: "text-purple-400", bg: "bg-purple-900/20" },
  proposal:    { label: "Proposal",    color: "text-yellow-400", bg: "bg-yellow-900/20" },
  negotiation: { label: "Negotiation", color: "text-orange-400", bg: "bg-orange-900/20" },
  won:         { label: "Won",         color: "text-green-400",  bg: "bg-green-900/20"  },
  lost:        { label: "Lost",        color: "text-red-400",    bg: "bg-red-900/20"    },
} as const;

function formatValue(value: string | null, currency: string) {
  if (!value) return null;
  const num = parseFloat(value);
  if (isNaN(num)) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(num);
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
    ({ label: deal.stage, color: "text-neutral-400", bg: "bg-neutral-800" } as const);
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
        <div>
          <h2 className="text-xl font-semibold text-neutral-100">{deal.title}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${stageMeta.bg} ${stageMeta.color}`}
            >
              {stageMeta.label}
            </span>
            {formatted ? (
              <span className="text-sm font-semibold text-indigo-400">{formatted}</span>
            ) : (
              <span className="text-xs text-neutral-500">Not set</span>
            )}
            {deal.expectedCloseDate && (
              <span className="text-xs text-neutral-500">
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
            <p className="mt-1.5 text-xs text-neutral-400">
              <span className="text-neutral-600">Reason: </span>
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
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 sm:p-5">
        <h3 className="mb-4 text-sm font-medium text-neutral-300">Details</h3>
        <EditDealForm
          key={formVersion}
          deal={deal}
          onSaved={handleFormSaved}
          onRollback={handleFormRollback}
        />
        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-neutral-800 pt-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-neutral-500">Created</dt>
            <dd className="mt-0.5 text-neutral-200">
              {initialDeal.createdAt.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Last updated</dt>
            <dd className="mt-0.5 text-neutral-200">
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
