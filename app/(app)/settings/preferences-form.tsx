"use client";

import { useActionState, useEffect } from "react";
import { savePreferences, type PreferencesFormState } from "./actions";
import type { CrmSettings } from "@/lib/settings";

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY"] as const;

const STAGES = [
  { value: "lead", label: "Lead" },
  { value: "qualified", label: "Qualified" },
  { value: "proposal", label: "Proposal" },
  { value: "negotiation", label: "Negotiation" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
] as const;

const initialState: PreferencesFormState = {};

export function PreferencesForm({ current }: { current: CrmSettings }) {
  const [state, formAction, pending] = useActionState(
    savePreferences,
    initialState
  );

  return (
    <form action={formAction} className="space-y-4">
      {/* Display Name */}
      <div>
        <label
          htmlFor="pf-displayName"
          className="mb-1 block text-xs font-medium text-neutral-400"
        >
          Display name
        </label>
        <input
          id="pf-displayName"
          name="displayName"
          type="text"
          placeholder="e.g. Alice Smith"
          defaultValue={current.displayName}
          maxLength={100}
          className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-indigo-500 focus:outline-none"
        />
        <p className="mt-1 text-xs text-neutral-600">
          Used as <code className="rounded bg-neutral-800 px-1 py-0.5">{"{{ownerName}}"}</code> in sequence templates.
        </p>
      </div>

      {/* Default Currency */}
      <div>
        <label
          htmlFor="pf-currency"
          className="mb-1 block text-xs font-medium text-neutral-400"
        >
          Default currency
        </label>
        <select
          id="pf-currency"
          name="defaultCurrency"
          defaultValue={current.defaultCurrency}
          className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 focus:border-indigo-500 focus:outline-none"
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-neutral-600">
          Pre-selected when creating a new deal.
        </p>
      </div>

      {/* Default Deal Stage */}
      <div>
        <label
          htmlFor="pf-stage"
          className="mb-1 block text-xs font-medium text-neutral-400"
        >
          Default deal stage
        </label>
        <select
          id="pf-stage"
          name="defaultDealStage"
          defaultValue={current.defaultDealStage}
          className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 focus:border-indigo-500 focus:outline-none"
        >
          {STAGES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-neutral-600">
          Pre-selected stage when creating a new deal.
        </p>
      </div>

      {state.noDb && (
        <p className="text-xs text-amber-400">
          Connect a database to save preferences.
        </p>
      )}
      {state.error && (
        <p className="text-xs text-red-400">{state.error}</p>
      )}
      {state.success && (
        <p className="text-xs text-emerald-400">Preferences saved.</p>
      )}

      <div className="flex justify-end pt-1">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save preferences"}
        </button>
      </div>
    </form>
  );
}
