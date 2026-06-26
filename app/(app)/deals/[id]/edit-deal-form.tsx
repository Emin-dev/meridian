"use client";

import { useState, useTransition, useEffect } from "react";
import { updateDealDetails } from "./actions";
import type { Deal } from "@/db/schema";
import { useToast } from "@/components/toaster";
import type { DealFormUpdate } from "./deal-detail-top";

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
  useEffect(() => {
    setStageValue(deal.stage);
  }, [deal.stage]);

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
    "w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-[--accent] focus:outline-none";
  const labelCls = "mb-1 block text-xs font-medium text-neutral-400";

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
          Title <span className="text-red-400">*</span>
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
          <p className="mt-1 text-xs text-red-400">{fieldErrors.title[0]}</p>
        )}
      </div>

      {/* Stage — controlled so it tracks parent stage changes */}
      <div>
        <label htmlFor="ed-stage" className={labelCls}>
          Stage
        </label>
        <select
          id="ed-stage"
          name="stage"
          value={stageValue}
          onChange={(e) => setStageValue(e.target.value as Deal["stage"])}
          className={inputCls}
        >
          {STAGES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        {fieldErrors.stage && (
          <p className="mt-1 text-xs text-red-400">{fieldErrors.stage[0]}</p>
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
          <p className="mt-1 text-xs text-red-400">{fieldErrors.value[0]}</p>
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
          <p className="mt-1 text-xs text-red-400">
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
            className="w-24 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-[--accent] focus:outline-none"
          />
          <div className="flex-1 overflow-hidden rounded-full bg-neutral-700 h-2">
            <div
              className="h-2 rounded-full bg-[--accent] transition-all"
              style={{ width: `${probPercent}%` }}
            />
          </div>
          <span className="w-10 text-right text-xs text-neutral-400">
            {probPercent}%
          </span>
        </div>
        {fieldErrors.probability && (
          <p className="mt-1 text-xs text-red-400">{fieldErrors.probability[0]}</p>
        )}
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-[--accent] px-4 py-2 text-sm font-medium text-[--accent-ink] transition-colors hover:bg-[--accent-hover] disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
