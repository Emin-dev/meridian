"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { createDeal, updateDeal, type DealFormState } from "./actions";
import { useToast } from "@/components/toaster";
import type { DealWithContact } from "./types";
import StageControl from "./stage-control";
import { extractUserNotes } from "./[id]/notes-utils";
import MobileActionSheet from "@/components/mobile-action-sheet";
import { VALID_CURRENCIES } from "@/lib/currencies";

const STAGES = [
  { value: "lead", label: "Lead" },
  { value: "qualified", label: "Qualified" },
  { value: "proposal", label: "Proposal" },
  { value: "negotiation", label: "Negotiation" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
] as const;

// Derive the picker options from the single server-side source so the modal can
// never offer (or omit) a code the server rejects / the seeded data contains
// (e.g. "AZN" — see lib/currencies.ts VALID_CURRENCIES).
const CURRENCIES = VALID_CURRENCIES;

type ContactOption = { id: number; name: string };

interface DealModalProps {
  hasDb: boolean;
  contacts: ContactOption[];
  deal?: DealWithContact;
  defaultCurrency?: string;
  defaultStage?: string;
  defaultContactId?: number;
  buttonLabel?: string;
}

function stageAgeInDays(updatedAt: Date): number {
  const diffMs = Date.now() - new Date(updatedAt).getTime();
  return Math.floor(diffMs / 86_400_000);
}

function ageBadgeClass(days: number): string {
  if (days < 7) return "bg-[var(--surface-2)] text-[var(--ink-2)]";
  if (days <= 14) return "bg-[var(--warn-tint)] text-[var(--warn)]";
  return "bg-[var(--bad-tint)] text-[var(--bad)]";
}

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

type DealAction = (
  prev: DealFormState,
  formData: FormData
) => Promise<DealFormState>;

const initialState: DealFormState = {};

export default function DealModal({
  hasDb,
  contacts,
  deal,
  defaultCurrency = "USD",
  defaultStage = "lead",
  defaultContactId,
  buttonLabel = "Add Deal",
}: DealModalProps) {
  const isEdit = !!deal;
  const action: DealAction = deal
    ? (updateDeal.bind(null, deal.id) as DealAction)
    : createDeal;

  const [state, formAction, pending] = useActionState(action, initialState);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const { toast } = useToast();

  // Controlled values so the desktop <select> and the mobile action-sheet
  // picker share a single source of truth (both submit via name="stage"/"currency").
  const [stage, setStage] = useState<string>(deal?.stage ?? defaultStage);
  const [currency, setCurrency] = useState<string>(deal?.currency ?? defaultCurrency);
  const [contactId, setContactId] = useState<string>(
    deal?.contactId?.toString() ?? defaultContactId?.toString() ?? ""
  );
  const [stageSheetOpen, setStageSheetOpen] = useState(false);
  const [currencySheetOpen, setCurrencySheetOpen] = useState(false);
  const [contactSheetOpen, setContactSheetOpen] = useState(false);
  const [contactQuery, setContactQuery] = useState("");

  useEffect(() => {
    if (state.success) {
      dialogRef.current?.close();
      formRef.current?.reset();
      // form.reset() can't reach controlled state; mirror its reset for the
      // create modal so reopening starts fresh (edit keeps the saved values).
      if (!isEdit) {
        setStage(defaultStage);
        setCurrency(defaultCurrency);
        setContactId(defaultContactId?.toString() ?? "");
      }
      setContactSheetOpen(false);
      setContactQuery("");
      toast(isEdit ? "Deal saved" : "Deal created");
    }
  }, [state.success, isEdit, defaultStage, defaultCurrency, defaultContactId, toast]);

  const openModal = () => {
    // Never let two modals stack/overlap: close any other open dialog first.
    document
      .querySelectorAll("dialog[open]")
      .forEach((d) => (d as HTMLDialogElement).close());
    dialogRef.current?.showModal();
  };

  const noDb = !hasDb || state.noDb;
  const defaultDate = deal?.expectedCloseDate
    ? new Date(deal.expectedCloseDate).toISOString().slice(0, 10)
    : "";
  const formatted = deal ? formatValue(deal.value, deal.currency) : null;

  return (
    <>
      {/* Trigger: card (edit) or button (create) */}
      {isEdit ? (
        <div className="rounded-lg border border-[var(--line-1)] bg-[var(--surface-1)] p-3 transition-colors hover:border-[var(--line-2)] hover:bg-[var(--surface-2)]">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-[var(--ink-1)] leading-snug">
              {deal.title}
            </p>
            <div className="flex shrink-0 items-center gap-1.5">
              {(() => {
                const age = stageAgeInDays(deal.updatedAt);
                return (
                  <span
                    className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${ageBadgeClass(age)}`}
                  >
                    {age}d
                  </span>
                );
              })()}
              <button
                type="button"
                onClick={openModal}
                className="shrink-0 rounded p-0.5 text-[var(--ink-3)] hover:bg-[var(--surface-2)] hover:text-[var(--ink-2)] transition-colors"
                aria-label="Edit deal"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
            </div>
          </div>
          {formatted && (
            <p className="mt-1 text-sm font-semibold text-[var(--accent)]">
              {formatted}
            </p>
          )}
          {deal.contact && (
            <Link
              href={`/contacts/${deal.contact.id}`}
              className="mt-2 flex items-center gap-1.5 text-xs text-[var(--ink-3)] hover:text-[var(--ink-2)] transition-colors"
            >
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--surface-3)] text-[10px] font-medium text-[var(--ink-2)]">
                {(deal.contact.name[0] ?? "?").toUpperCase()}
              </span>
              {deal.contact.name}
            </Link>
          )}
          {deal.expectedCloseDate && (
            <p className="mt-1.5 text-xs text-[var(--ink-3)]">
              Close:{" "}
              {new Date(deal.expectedCloseDate).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          )}
          <Link
            href={`/deals/${deal.id}`}
            className="mt-2 inline-block text-xs text-[var(--ink-3)] hover:text-[var(--accent)] transition-colors"
          >
            View details →
          </Link>
          <StageControl dealId={deal.id} stage={deal.stage} />
        </div>
      ) : (
        <button
          type="button"
          onClick={openModal}
          className="tap inline-flex items-center justify-center rounded-lg bg-[var(--accent)] px-4 text-sm font-medium text-[var(--accent-ink)] transition-colors hover:bg-[var(--accent-hover)]"
        >
          {buttonLabel}
        </button>
      )}

      {/*
        Mobile: bottom sheet — pinned inset-x-0 bottom-0, rounded top corners, full width.
        Desktop (sm:): centered modal — restore UA inset-0 + m-auto centering, max-w-lg.
      */}
      <dialog
        ref={dialogRef}
        aria-label={isEdit ? "Edit deal" : "New deal"}
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current?.close();
        }}
        className="
          m-0 inset-x-0 bottom-0 top-auto
          w-full max-w-none rounded-t-[var(--r-2xl)]
          max-h-[90dvh] overflow-hidden flex flex-col
          border border-[var(--line-1)] bg-[var(--surface-1)] p-0 text-[var(--ink-1)] shadow-2xl
          backdrop:bg-black/60
          sm:m-auto sm:inset-0 sm:max-w-lg sm:w-full sm:rounded-xl
        "
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between border-b border-[var(--line-1)] px-6 py-4">
          <h2 className="text-base font-semibold">
            {isEdit ? "Edit Deal" : "New Deal"}
          </h2>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="tap flex items-center justify-center rounded-lg text-[var(--ink-2)] hover:bg-[var(--surface-2)] hover:text-[var(--ink-1)] transition-colors"
            aria-label="Close"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* No-DB state */}
        {noDb ? (
          <div className="flex-1 overflow-y-auto space-y-2 px-6 py-10 text-center">
            <p className="text-sm text-[var(--ink-2)]">Database not connected.</p>
            <p className="text-xs text-[var(--ink-3)]">
              Set{" "}
              <code className="rounded bg-[var(--surface-3)] px-1 py-0.5">
                DATABASE_URL
              </code>{" "}
              to save deals.
            </p>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="mt-4 rounded-lg bg-[var(--surface-2)] px-4 py-2 text-sm text-[var(--ink-2)] hover:bg-[var(--surface-3)]"
            >
              Close
            </button>
          </div>
        ) : (
          /* Form: flex column so body scrolls and footer sticks */
          <form
            ref={formRef}
            action={formAction}
            className="flex flex-col flex-1 min-h-0"
          >
            {/* Scrollable fields */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {/* Title */}
              <div>
                <label
                  htmlFor="dm-title"
                  className="mb-1 block text-xs font-medium text-[var(--ink-2)]"
                >
                  Title <span className="text-[var(--bad)]">*</span>
                </label>
                <input
                  id="dm-title"
                  name="title"
                  type="text"
                  required
                  placeholder="Acme Corp — Enterprise"
                  defaultValue={deal?.title ?? ""}
                  className="w-full rounded-lg border border-[var(--line-1)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--ink-1)] placeholder:text-[var(--ink-3)] focus:border-[var(--accent)] focus:outline-none"
                />
                {state.fieldErrors?.title && (
                  <p className="mt-1 text-xs text-[var(--bad)]">
                    {state.fieldErrors.title[0]}
                  </p>
                )}
              </div>

              {/* Stage */}
              <div>
                <label
                  htmlFor="dm-stage"
                  className="mb-1 block text-xs font-medium text-[var(--ink-2)]"
                >
                  Stage
                </label>
                {/* Desktop: native select. Hidden on mobile but still submits `stage`. */}
                <select
                  id="dm-stage"
                  name="stage"
                  value={stage}
                  onChange={(e) => setStage(e.target.value)}
                  className="hidden w-full rounded-lg border border-[var(--line-1)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--ink-1)] focus:border-[var(--accent)] focus:outline-none sm:block"
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
                  className="tap flex w-full items-center justify-between gap-2 rounded-lg border border-[var(--line-1)] bg-[var(--surface-2)] px-3 py-2 text-left text-sm text-[var(--ink-1)] focus:border-[var(--accent)] focus:outline-none sm:hidden"
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
              </div>

              {/* Value + Currency */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="dm-value"
                    className="mb-1 block text-xs font-medium text-[var(--ink-2)]"
                  >
                    Value
                  </label>
                  <input
                    id="dm-value"
                    name="value"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="10000"
                    defaultValue={deal?.value ?? ""}
                    className="w-full rounded-lg border border-[var(--line-1)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--ink-1)] placeholder:text-[var(--ink-3)] focus:border-[var(--accent)] focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="dm-currency"
                    className="mb-1 block text-xs font-medium text-[var(--ink-2)]"
                  >
                    Currency
                  </label>
                  {/* Desktop: native select. Hidden on mobile but still submits `currency`. */}
                  <select
                    id="dm-currency"
                    name="currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="hidden w-full rounded-lg border border-[var(--line-1)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--ink-1)] focus:border-[var(--accent)] focus:outline-none sm:block"
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
                    className="tap flex w-full items-center justify-between gap-2 rounded-lg border border-[var(--line-1)] bg-[var(--surface-2)] px-3 py-2 text-left text-sm text-[var(--ink-1)] focus:border-[var(--accent)] focus:outline-none sm:hidden"
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
                </div>
              </div>

              {/* Expected Close Date */}
              <div>
                <label
                  htmlFor="dm-close-date"
                  className="mb-1 block text-xs font-medium text-[var(--ink-2)]"
                >
                  Expected Close Date
                </label>
                <input
                  id="dm-close-date"
                  name="expectedCloseDate"
                  type="date"
                  defaultValue={defaultDate}
                  className="w-full rounded-lg border border-[var(--line-1)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--ink-1)] focus:border-[var(--accent)] focus:outline-none"
                />
              </div>

              {/* Contact */}
              <div>
                <label
                  htmlFor="dm-contact"
                  className="mb-1 block text-xs font-medium text-[var(--ink-2)]"
                >
                  Contact
                </label>
                {/* Desktop: native select. Hidden on mobile but still submits `contactId`. */}
                <select
                  id="dm-contact"
                  name="contactId"
                  value={contactId}
                  onChange={(e) => setContactId(e.target.value)}
                  className="hidden w-full rounded-lg border border-[var(--line-1)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--ink-1)] focus:border-[var(--accent)] focus:outline-none sm:block"
                >
                  <option value="">— None —</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id.toString()}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {/* Mobile: 44px button opening a searchable action sheet. */}
                <button
                  type="button"
                  onClick={() => setContactSheetOpen(true)}
                  className="tap flex w-full items-center justify-between gap-2 rounded-lg border border-[var(--line-1)] bg-[var(--surface-2)] px-3 py-2 text-left text-sm text-[var(--ink-1)] focus:border-[var(--accent)] focus:outline-none sm:hidden"
                >
                  <span className="truncate">
                    {contacts.find((c) => c.id.toString() === contactId)?.name ??
                      "— None —"}
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
              </div>

              {/* Owner */}
              <div>
                <label
                  htmlFor="dm-owner"
                  className="mb-1 block text-xs font-medium text-[var(--ink-2)]"
                >
                  Owner
                </label>
                <input
                  id="dm-owner"
                  name="owner"
                  type="text"
                  placeholder="Assigned rep"
                  defaultValue={deal?.owner ?? ""}
                  className="w-full rounded-lg border border-[var(--line-1)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--ink-1)] placeholder:text-[var(--ink-3)] focus:border-[var(--accent)] focus:outline-none"
                />
              </div>

              {/* Notes */}
              <div>
                <label
                  htmlFor="dm-notes"
                  className="mb-1 block text-xs font-medium text-[var(--ink-2)]"
                >
                  Notes
                </label>
                <textarea
                  id="dm-notes"
                  name="notes"
                  rows={3}
                  placeholder="Any notes about this deal…"
                  defaultValue={extractUserNotes(deal?.notes ?? null) ?? ""}
                  className="w-full resize-none rounded-lg border border-[var(--line-1)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--ink-1)] placeholder:text-[var(--ink-3)] focus:border-[var(--accent)] focus:outline-none"
                />
              </div>

              {state.error && (
                <p className="text-xs text-[var(--bad)]">{state.error}</p>
              )}
            </div>

            {/* Sticky footer — pb absorbs iOS home indicator */}
            <div className="shrink-0 flex justify-end gap-3 border-t border-[var(--line-1)] px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                className="rounded-lg px-4 py-2 text-sm text-[var(--ink-2)] hover:bg-[var(--surface-2)] hover:text-[var(--ink-1)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-ink)] transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50"
              >
                {pending ? "Saving…" : isEdit ? "Save changes" : "Create deal"}
              </button>
            </div>

            {/* Mobile: stage + currency pickers (desktop uses the native selects). */}
            <div className="sm:hidden">
              <MobileActionSheet
                open={stageSheetOpen}
                onClose={() => setStageSheetOpen(false)}
                title="Stage"
              >
                <div
                  role="radiogroup"
                  aria-label="Stage"
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

              <MobileActionSheet
                open={currencySheetOpen}
                onClose={() => setCurrencySheetOpen(false)}
                title="Currency"
              >
                <div
                  role="radiogroup"
                  aria-label="Currency"
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
                open={contactSheetOpen}
                onClose={() => {
                  setContactSheetOpen(false);
                  setContactQuery("");
                }}
                title="Contact"
              >
                <input
                  type="text"
                  inputMode="search"
                  value={contactQuery}
                  onChange={(e) => setContactQuery(e.target.value)}
                  placeholder="Search contacts…"
                  aria-label="Search contacts"
                  className="mb-2 w-full rounded-lg border border-[var(--line-1)] bg-[var(--surface-3)] px-3 py-2 text-sm text-[var(--ink-1)] placeholder:text-[var(--ink-3)] focus:border-[var(--accent)] focus:outline-none"
                />
                <div
                  role="radiogroup"
                  aria-label="Contact"
                  className="flex max-h-[40dvh] flex-col gap-2 overflow-y-auto"
                >
                  {[{ id: 0, name: "— None —" }, ...contacts]
                    .filter(
                      (c) =>
                        c.id === 0 ||
                        c.name.toLowerCase().includes(contactQuery.trim().toLowerCase())
                    )
                    .map((c) => {
                      const cid = c.id === 0 ? "" : c.id.toString();
                      const selected = contactId === cid;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          role="radio"
                          onClick={() => {
                            setContactId(cid);
                            setContactSheetOpen(false);
                            setContactQuery("");
                          }}
                          aria-checked={selected}
                          className={`tap flex items-center justify-between gap-2 rounded-lg px-3 text-left text-body transition-colors ${
                            selected
                              ? "bg-[var(--surface-3)] text-[var(--ink-1)]"
                              : "text-[var(--ink-2)] hover:bg-[var(--surface-3)]"
                          }`}
                        >
                          <span className="truncate">{c.name}</span>
                          {selected && (
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
                      );
                    })}
                  {contacts.length > 0 &&
                    contacts.filter((c) =>
                      c.name.toLowerCase().includes(contactQuery.trim().toLowerCase())
                    ).length === 0 && (
                      <p className="px-3 py-2 text-xs text-[var(--ink-3)]">
                        No contacts match “{contactQuery.trim()}”.
                      </p>
                    )}
                </div>
              </MobileActionSheet>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
