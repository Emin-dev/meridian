"use client";

import { useActionState, useEffect } from "react";
import { updateDealDetails, type DealDetailsState } from "./actions";
import type { Deal } from "@/db/schema";
import { useToast } from "@/components/toaster";

const STAGES = [
  { value: "lead", label: "Lead" },
  { value: "qualified", label: "Qualified" },
  { value: "proposal", label: "Proposal" },
  { value: "negotiation", label: "Negotiation" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
] as const;

const initialState: DealDetailsState = {};

interface Props {
  deal: Deal;
}

export default function EditDealForm({ deal }: Props) {
  const boundUpdate = updateDealDetails.bind(null, deal.id);
  const [state, formAction, pending] = useActionState(boundUpdate, initialState);
  const { toast } = useToast();

  useEffect(() => {
    if (state.success) toast("Deal saved");
    if (state.error) toast(state.error, "error");
  }, [state.success, state.error, toast]);

  const closeDateValue = deal.expectedCloseDate
    ? (deal.expectedCloseDate instanceof Date
        ? deal.expectedCloseDate
        : new Date(deal.expectedCloseDate)
      )
        .toISOString()
        .slice(0, 10)
    : "";

  const inputCls =
    "w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-indigo-500 focus:outline-none";
  const labelCls = "mb-1 block text-xs font-medium text-neutral-400";

  return (
    <form action={formAction} className="space-y-4">
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
        {state.fieldErrors?.title && (
          <p className="mt-1 text-xs text-red-400">{state.fieldErrors.title[0]}</p>
        )}
      </div>

      {/* Stage */}
      <div>
        <label htmlFor="ed-stage" className={labelCls}>
          Stage
        </label>
        <select
          id="ed-stage"
          name="stage"
          defaultValue={deal.stage}
          className={inputCls}
        >
          {STAGES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        {state.fieldErrors?.stage && (
          <p className="mt-1 text-xs text-red-400">{state.fieldErrors.stage[0]}</p>
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
        {state.fieldErrors?.value && (
          <p className="mt-1 text-xs text-red-400">{state.fieldErrors.value[0]}</p>
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
        {state.fieldErrors?.expectedCloseDate && (
          <p className="mt-1 text-xs text-red-400">
            {state.fieldErrors.expectedCloseDate[0]}
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
            defaultValue={deal.probability}
            className="w-24 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-indigo-500 focus:outline-none"
          />
          <div className="flex-1 overflow-hidden rounded-full bg-neutral-700 h-2">
            <div
              className="h-2 rounded-full bg-indigo-500 transition-all"
              style={{ width: `${deal.probability}%` }}
            />
          </div>
          <span className="w-10 text-right text-xs text-neutral-400">{deal.probability}%</span>
        </div>
        {state.fieldErrors?.probability && (
          <p className="mt-1 text-xs text-red-400">{state.fieldErrors.probability[0]}</p>
        )}
      </div>

      {state.noDb && (
        <p className="text-xs text-red-400">
          Database not connected — changes cannot be saved.
        </p>
      )}

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
