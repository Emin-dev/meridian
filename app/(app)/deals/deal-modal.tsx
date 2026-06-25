"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { createDeal, updateDeal, type DealFormState } from "./actions";
import { useToast } from "@/components/toaster";
import type { Deal, Contact } from "@/db/schema";
import StageControl from "./stage-control";

const STAGES = [
  { value: "lead", label: "Lead" },
  { value: "qualified", label: "Qualified" },
  { value: "proposal", label: "Proposal" },
  { value: "negotiation", label: "Negotiation" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
] as const;

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY"];

type ContactOption = { id: number; name: string };

interface DealModalProps {
  hasDb: boolean;
  contacts: ContactOption[];
  deal?: Deal & { contact: Contact | null };
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
  if (days < 7) return "bg-green-500/15 text-green-400";
  if (days <= 14) return "bg-amber-500/15 text-amber-400";
  return "bg-red-500/15 text-red-400";
}

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

  useEffect(() => {
    if (state.success) {
      dialogRef.current?.close();
      formRef.current?.reset();
      toast(isEdit ? "Deal saved" : "Deal created");
    }
  }, [state.success, isEdit, toast]);

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
        <div className="rounded-lg border border-neutral-800 bg-neutral-800/50 p-3 transition-colors hover:border-neutral-700 hover:bg-neutral-800">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-neutral-100 leading-snug">
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
                className="shrink-0 rounded p-0.5 text-neutral-600 hover:bg-neutral-700 hover:text-neutral-300 transition-colors"
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
            <p className="mt-1 text-sm font-semibold text-indigo-400">
              {formatted}
            </p>
          )}
          {deal.contact && (
            <Link
              href={`/contacts/${deal.contact.id}`}
              className="mt-2 flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-neutral-700 text-[10px] font-medium text-neutral-300">
                {deal.contact.name[0].toUpperCase()}
              </span>
              {deal.contact.name}
            </Link>
          )}
          {deal.expectedCloseDate && (
            <p className="mt-1.5 text-xs text-neutral-600">
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
            className="mt-2 inline-block text-xs text-neutral-600 hover:text-indigo-400 transition-colors"
          >
            View details →
          </Link>
          <StageControl dealId={deal.id} stage={deal.stage} />
        </div>
      ) : (
        <button
          type="button"
          onClick={openModal}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
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
          border border-neutral-800 bg-neutral-900 p-0 text-neutral-100 shadow-2xl
          backdrop:bg-black/60
          sm:m-auto sm:inset-0 sm:max-w-lg sm:w-full sm:rounded-xl
        "
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between border-b border-neutral-800 px-6 py-4">
          <h2 className="text-base font-semibold">
            {isEdit ? "Edit Deal" : "New Deal"}
          </h2>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="tap flex items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100 transition-colors"
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
            <p className="text-sm text-neutral-300">Database not connected.</p>
            <p className="text-xs text-neutral-500">
              Set{" "}
              <code className="rounded bg-neutral-800 px-1 py-0.5">
                DATABASE_URL
              </code>{" "}
              to save deals.
            </p>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="mt-4 rounded-lg bg-neutral-800 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-700"
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
                  className="mb-1 block text-xs font-medium text-neutral-400"
                >
                  Title <span className="text-red-400">*</span>
                </label>
                <input
                  id="dm-title"
                  name="title"
                  type="text"
                  required
                  placeholder="Acme Corp — Enterprise"
                  defaultValue={deal?.title ?? ""}
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-indigo-500 focus:outline-none"
                />
                {state.fieldErrors?.title && (
                  <p className="mt-1 text-xs text-red-400">
                    {state.fieldErrors.title[0]}
                  </p>
                )}
              </div>

              {/* Stage */}
              <div>
                <label
                  htmlFor="dm-stage"
                  className="mb-1 block text-xs font-medium text-neutral-400"
                >
                  Stage
                </label>
                <select
                  id="dm-stage"
                  name="stage"
                  defaultValue={deal?.stage ?? defaultStage}
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 focus:border-indigo-500 focus:outline-none"
                >
                  {STAGES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Value + Currency */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="dm-value"
                    className="mb-1 block text-xs font-medium text-neutral-400"
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
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="dm-currency"
                    className="mb-1 block text-xs font-medium text-neutral-400"
                  >
                    Currency
                  </label>
                  <select
                    id="dm-currency"
                    name="currency"
                    defaultValue={deal?.currency ?? defaultCurrency}
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 focus:border-indigo-500 focus:outline-none"
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Expected Close Date */}
              <div>
                <label
                  htmlFor="dm-close-date"
                  className="mb-1 block text-xs font-medium text-neutral-400"
                >
                  Expected Close Date
                </label>
                <input
                  id="dm-close-date"
                  name="expectedCloseDate"
                  type="date"
                  defaultValue={defaultDate}
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* Contact */}
              <div>
                <label
                  htmlFor="dm-contact"
                  className="mb-1 block text-xs font-medium text-neutral-400"
                >
                  Contact
                </label>
                <select
                  id="dm-contact"
                  name="contactId"
                  defaultValue={
                    deal?.contactId?.toString() ??
                    defaultContactId?.toString() ??
                    ""
                  }
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">— None —</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id.toString()}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Owner */}
              <div>
                <label
                  htmlFor="dm-owner"
                  className="mb-1 block text-xs font-medium text-neutral-400"
                >
                  Owner
                </label>
                <input
                  id="dm-owner"
                  name="owner"
                  type="text"
                  placeholder="Assigned rep"
                  defaultValue={deal?.owner ?? ""}
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* Notes */}
              <div>
                <label
                  htmlFor="dm-notes"
                  className="mb-1 block text-xs font-medium text-neutral-400"
                >
                  Notes
                </label>
                <textarea
                  id="dm-notes"
                  name="notes"
                  rows={3}
                  placeholder="Any notes about this deal…"
                  defaultValue={deal?.notes ?? ""}
                  className="w-full resize-none rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {state.error && (
                <p className="text-xs text-red-400">{state.error}</p>
              )}
            </div>

            {/* Sticky footer — pb absorbs iOS home indicator */}
            <div className="shrink-0 flex justify-end gap-3 border-t border-neutral-800 px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                className="rounded-lg px-4 py-2 text-sm text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
              >
                {pending ? "Saving…" : isEdit ? "Save changes" : "Create deal"}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
