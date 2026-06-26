"use client";

import { useActionState } from "react";
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

const inputCls =
  "tap w-full rounded-[var(--r-md)] border border-[var(--line-1)] bg-[var(--surface-1)] px-3 py-2.5 text-body text-[var(--ink-1)] placeholder:text-[var(--ink-3)] [color-scheme:dark] outline-none focus:border-[var(--accent)] transition-colors";

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
          className="mb-1.5 block text-footnote font-medium text-[var(--ink-2)]"
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
          className={inputCls}
        />
        <p className="mt-1 text-caption text-[var(--ink-3)]">
          Used as{" "}
          <code className="rounded bg-[var(--surface-2)] px-1 py-0.5">
            {"{{ownerName}}"}
          </code>{" "}
          in sequence templates.
        </p>
      </div>

      {/* Default Currency */}
      <div>
        <label
          htmlFor="pf-currency"
          className="mb-1.5 block text-footnote font-medium text-[var(--ink-2)]"
        >
          Default currency
        </label>
        <select
          id="pf-currency"
          name="defaultCurrency"
          defaultValue={current.defaultCurrency}
          className={inputCls}
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <p className="mt-1 text-caption text-[var(--ink-3)]">
          Pre-selected when creating a new deal.
        </p>
      </div>

      {/* Default Deal Stage */}
      <div>
        <label
          htmlFor="pf-stage"
          className="mb-1.5 block text-footnote font-medium text-[var(--ink-2)]"
        >
          Default deal stage
        </label>
        <select
          id="pf-stage"
          name="defaultDealStage"
          defaultValue={current.defaultDealStage}
          className={inputCls}
        >
          {STAGES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-caption text-[var(--ink-3)]">
          Pre-selected stage when creating a new deal.
        </p>
      </div>

      {state.noDb && (
        <p role="alert" className="text-caption text-[var(--warn)]">
          Connect a database to save preferences.
        </p>
      )}
      {state.error && (
        <p role="alert" className="text-caption text-[var(--bad)]">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-caption text-[var(--ok)]">
          Preferences saved.
        </p>
      )}

      <div>
        <button
          type="submit"
          disabled={pending}
          className="tap press w-full rounded-[var(--r-md)] bg-[var(--accent)] px-5 text-body font-medium text-[var(--accent-ink)] hover:opacity-90 disabled:opacity-50 sm:w-auto"
        >
          {pending ? "Saving…" : "Save preferences"}
        </button>
      </div>
    </form>
  );
}
