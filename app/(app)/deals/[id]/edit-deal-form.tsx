"use client";

import { useState, useTransition, useEffect } from "react";
import { updateDealDetails } from "./actions";
import type { Deal } from "@/db/schema";
import { useToast } from "@/components/toaster";
import type { DealFormUpdate } from "./deal-detail-top";
import MobileActionSheet from "@/components/mobile-action-sheet";

const STAGES = [
  { value: "lead",        label: "Lead"        },
  { value: "qualified",   label: "Qualified"   },
  { value: "proposal",    label: "Proposal"    },
  { value: "negotiation", label: "Negotiation" },
  { value: "won",         label: "Won"         },
  { value: "lost",        label: "Lost"        },
] as const;

interface Props {
  deal: Deal;
  /** Called immediately on submit with optimistic values. */
  onSaved?: (updates: DealFormUpdate) => void;
  /** Called if the server action fails; roll back to this snapshot. */
  onRollback?: (snapshot: Deal) => void;
}

export default function EditDealForm({ deal, onSaved, onRollback }: Props) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<"title" | "stage" | "value" | "expectedCloseDate" | "probability", string[]>>
  >({});

  // Stage is controlled so it stays in sync when StageControl moves the deal
  // (the parent updates deal.stage without remounting this form).
  const [stageValue, setStageValue] = useState<Deal["stage"]>(deal.stage);
  const [stageSheetOpen, setStageSheetOpen] = useState(false);
  useEffect(() => {
    setStageValue(deal.stage);
  }, [deal.stage]);
  const stageLabel =
    STAGES.find((s) => s.value === stageValue)?.label ?? stageValue;

  // Probability is controlled so the progress bar tracks the input live.
  const [probInput, setProbInput] = useState(String(deal.probability));
  useEffect(() => {
    setProbInput(String(deal.probability));
  }, [deal.probability]);
  const probPercent = Math.max(0, Math.min(100, parseInt(probInput || "0", 10) || 0));

  const closeDateValue = deal.expectedCloseDate
    ? (deal.expectedCloseDate instanceof Date
        ? deal.expectedCloseDate
        : new Date(deal.expectedCloseDate)
      )
        .toISOString()
        .slice(0, 10)
    : "";

  const inputCls =
    "tap w-full rounded-lg border border-[var(--line-1)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--ink-1)] placeholder-[var(--ink-3)] focus:border-[var(--accent)] focus:outline-none";
  const labelCls = "mb-1 block text-xs font-medium text-[var(--ink-2)]";

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const snapshot = { ...deal };

    // Read optimistic values from the form
    const valueRaw = String(formData.get("value") ?? "").trim();
    const dateRaw  = String(formData.get("expectedCloseDate") ?? "").trim();
    const probRaw  = String(formData.get("probability") ?? "0").trim();
    const updates: DealFormUpdate = {
      title:             String(formData.get("title") ?? "").trim(),
      stage:             String(formData.get("stage") ?? deal.stage) as DealFormUpdate["stage"],
      value:             valueRaw === "" ? null : valueRaw,
      expectedCloseDate: dateRaw === "" ? null : new Date(dateRaw),
      probability:       probRaw === "" ? 0 : parseInt(probRaw, 10),
    };

    // Optimistic: update the parent header immediately
    onSaved?.(updates);
    setFieldErrors({});

    startTransition(async () => {
      const result = await updateDealDetails(deal.id, {}, formData);
      if (result.error) {
        onRollback?.(snapshot);
        toast(result.error, "error");
      } else if (result.fieldErrors) {
        onRollback?.(snapshot);
        setFieldErrors(result.fieldErrors);
        toast("Please fix the highlighted errors", "error");
      } else if (result.noDb) {
        onRollback?.(snapshot);
        toast("Database not connected — changes cannot be saved.", "error");
      } else if (result.success) {
        toast("Deal saved");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Title */}
      <div>
        <label htmlFor="ed-title" className={labelCls}>
          Title <span className="text-[var(--bad)]">*</span>
        </label>
        <input
          id="ed-title"
          name="title"
          type="text"
          required
          defaultValue={deal.title}
          className={inputCls}
        />
        {fieldErrors.title && (
          <p className="mt-1 text-xs text-[var(--bad)]">{fieldErrors.title[0]}</p>
        )}
      </div>

      {/* Stage — controlled so it tracks parent stage changes */}
      <div>
        <label htmlFor="ed-stage" className={labelCls}>
          Stage
        </label>
        {/* Desktop: native select. Hidden (display:none) on mobile but still
            submits `stage` as the form's single source of truth. */}
        <select
          id="ed-stage"
          name="stage"
          value={stageValue}
          onChange={(e) => setStageValue(e.target.value as Deal["stage"])}
          className={`${inputCls} hidden sm:block`}
        >
          {STAGES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        {/* Mobile: 44px button opening an action sheet instead of a native dropdown. */}
        <button
          type="button"
          onClick={() => setStageSheetOpen(true)}
          className={`${inputCls} flex items-center justify-between gap-2 text-left sm:hidden`}
        >
          <span>{stageLabel}</span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 text-[var(--ink-3)]"
            aria-hidden="true"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        {fieldErrors.stage && (
          <p className="mt-1 text-xs text-[var(--bad)]">{fieldErrors.stage[0]}</p>
        )}
      </div>

      {/* Value */}
      <div>
        <label htmlFor="ed-value" className={labelCls}>
          Value ({deal.currency})
        </label>
        <input
          id="ed-value"
          name="value"
          type="number"
          min="0"
          step="0.01"
          defaultValue={deal.value ?? ""}
          placeholder="0.00"
          className={inputCls}
        />
        {fieldErrors.value && (
          <p className="mt-1 text-xs text-[var(--bad)]">{fieldErrors.value[0]}</p>
        )}
      </div>

      {/* Expected close date */}
      <div>
        <label htmlFor="ed-closedate" className={labelCls}>
          Expected close date
        </label>
        <input
          id="ed-closedate"
          name="expectedCloseDate"
          type="date"
          defaultValue={closeDateValue}
          className={inputCls}
        />
        {fieldErrors.expectedCloseDate && (
          <p className="mt-1 text-xs text-[var(--bad)]">
            {fieldErrors.expectedCloseDate[0]}
          </p>
        )}
      </div>

      {/* Probability */}
      <div>
        <label htmlFor="ed-probability" className={labelCls}>
          Probability (%)
        </label>
        <div className="flex items-center gap-3">
          <input
            id="ed-probability"
            name="probability"
            type="number"
            min="0"
            max="100"
            step="1"
            value={probInput}
            onChange={(e) => setProbInput(e.target.value)}
            className="tap w-24 rounded-lg border border-[var(--line-1)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--ink-1)] placeholder-[var(--ink-3)] focus:border-[var(--accent)] focus:outline-none"
          />
          <div className="flex-1 overflow-hidden rounded-full bg-[var(--surface-3)] h-2">
            <div
              className="h-2 rounded-full bg-[var(--accent)] transition-all"
              style={{ width: `${probPercent}%` }}
            />
          </div>
          <span className="w-10 text-right text-xs text-[var(--ink-2)]">
            {probPercent}%
          </span>
        </div>
        {fieldErrors.probability && (
          <p className="mt-1 text-xs text-[var(--bad)]">{fieldErrors.probability[0]}</p>
        )}
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={pending}
          className="tap inline-flex items-center justify-center rounded-lg bg-[var(--accent)] px-4 text-sm font-medium text-[var(--accent-ink)] transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>

      {/* Mobile: stage picker bottom sheet (desktop uses the native select). */}
      <div className="sm:hidden">
        <MobileActionSheet
          open={stageSheetOpen}
          onClose={() => setStageSheetOpen(false)}
          title="Stage"
        >
          <div className="flex flex-col gap-2">
            {STAGES.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => {
                  setStageValue(s.value);
                  setStageSheetOpen(false);
                }}
                aria-pressed={stageValue === s.value}
                className={`tap flex items-center justify-between rounded-lg px-3 text-left text-body transition-colors ${
                  stageValue === s.value
                    ? "bg-[var(--surface-3)] text-[var(--ink-1)]"
                    : "text-[var(--ink-2)] hover:bg-[var(--surface-3)]"
                }`}
              >
                <span>{s.label}</span>
                {stageValue === s.value && (
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="shrink-0 text-[var(--accent)]"
                    aria-hidden="true"
                  >
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </MobileActionSheet>
      </div>
    </form>
  );
}
