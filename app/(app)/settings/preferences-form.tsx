"use client";

import { useActionState, useState } from "react";
import { savePreferences, type PreferencesFormState } from "./actions";
import type { CrmSettings } from "@/lib/settings";
import MobileActionSheet from "@/components/mobile-action-sheet";

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
  "tap w-full rounded-[var(--r-md)] border border-[var(--line-1)] bg-[var(--surface-1)] px-3 py-2.5 text-body text-[var(--ink-1)] placeholder:text-[var(--ink-3)] [color-scheme:dark] focus:border-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2 transition-colors";

export function PreferencesForm({ current }: { current: CrmSettings }) {
  const [state, formAction, pending] = useActionState(
    savePreferences,
    initialState
  );

  // Controlled values so the desktop <select> and the mobile action-sheet
  // picker share a single source of truth (both submit via
  // name="defaultCurrency"/"defaultDealStage").
  const [currency, setCurrency] = useState<string>(current.defaultCurrency);
  const [stage, setStage] = useState<string>(current.defaultDealStage);
  const [currencySheetOpen, setCurrencySheetOpen] = useState(false);
  const [stageSheetOpen, setStageSheetOpen] = useState(false);

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
        {/* Desktop: native select. Hidden on mobile but still submits `defaultCurrency`. */}
        <select
          id="pf-currency"
          name="defaultCurrency"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          className={`${inputCls} hidden sm:block`}
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {/* Mobile: 44px button opening an action sheet instead of a dropdown. */}
        <button
          type="button"
          onClick={() => setCurrencySheetOpen(true)}
          className={`${inputCls} flex items-center justify-between gap-2 text-left sm:hidden`}
        >
          <span>{currency}</span>
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
        {/* Desktop: native select. Hidden on mobile but still submits `defaultDealStage`. */}
        <select
          id="pf-stage"
          name="defaultDealStage"
          value={stage}
          onChange={(e) => setStage(e.target.value)}
          className={`${inputCls} hidden sm:block`}
        >
          {STAGES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        {/* Mobile: 44px button opening an action sheet instead of a dropdown. */}
        <button
          type="button"
          onClick={() => setStageSheetOpen(true)}
          className={`${inputCls} flex items-center justify-between gap-2 text-left sm:hidden`}
        >
          <span>
            {STAGES.find((s) => s.value === stage)?.label ?? "Lead"}
          </span>
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
          className="tap press inline-flex w-full items-center justify-center rounded-lg bg-[var(--accent)] px-4 text-sm font-medium text-[var(--accent-ink)] hover:bg-[var(--accent-hover)] disabled:opacity-50 sm:w-auto"
        >
          {pending ? "Saving…" : "Save preferences"}
        </button>
      </div>

      {/* Mobile: currency + stage pickers (desktop uses the native selects). */}
      <div className="sm:hidden">
        <MobileActionSheet
          open={currencySheetOpen}
          onClose={() => setCurrencySheetOpen(false)}
          title="Default currency"
        >
          <div
            role="radiogroup"
            aria-label="Default currency"
            className="flex flex-col gap-2"
          >
            {CURRENCIES.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                onClick={() => {
                  setCurrency(c);
                  setCurrencySheetOpen(false);
                }}
                aria-checked={currency === c}
                className={`tap flex items-center justify-between rounded-lg px-3 text-left text-body transition-colors ${
                  currency === c
                    ? "bg-[var(--surface-3)] text-[var(--ink-1)]"
                    : "text-[var(--ink-2)] hover:bg-[var(--surface-3)]"
                }`}
              >
                <span>{c}</span>
                {currency === c && (
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

        <MobileActionSheet
          open={stageSheetOpen}
          onClose={() => setStageSheetOpen(false)}
          title="Default deal stage"
        >
          <div
            role="radiogroup"
            aria-label="Default deal stage"
            className="flex flex-col gap-2"
          >
            {STAGES.map((s) => (
              <button
                key={s.value}
                type="button"
                role="radio"
                onClick={() => {
                  setStage(s.value);
                  setStageSheetOpen(false);
                }}
                aria-checked={stage === s.value}
                className={`tap flex items-center justify-between rounded-lg px-3 text-left text-body transition-colors ${
                  stage === s.value
                    ? "bg-[var(--surface-3)] text-[var(--ink-1)]"
                    : "text-[var(--ink-2)] hover:bg-[var(--surface-3)]"
                }`}
              >
                <span>{s.label}</span>
                {stage === s.value && (
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
