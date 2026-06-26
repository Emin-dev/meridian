"use client";

import { useState } from "react";
import type { SequenceStep } from "@/db/schema";
import MobileActionSheet from "@/components/mobile-action-sheet";
import {
  interpolate,
  contactToVars,
  PLACEHOLDER_VARS,
  type TemplateVars,
} from "@/lib/template";

export interface PreviewContact {
  id: number;
  name: string;
  email: string | null;
  company: string | null;
  owner: string | null;
}

const VAR_LABELS: { key: keyof TemplateVars; label: string; token: string }[] =
  [
    { key: "firstName", label: "First Name", token: "{{firstName}}" },
    { key: "lastName", label: "Last Name", token: "{{lastName}}" },
    { key: "company", label: "Company", token: "{{company}}" },
    { key: "ownerName", label: "Owner", token: "{{ownerName}}" },
  ];

function buildVars(
  contact: PreviewContact | null,
  defaultOwnerName: string
): TemplateVars {
  const ownerFallback = defaultOwnerName || PLACEHOLDER_VARS.ownerName;
  if (!contact) return { ...PLACEHOLDER_VARS, ownerName: ownerFallback };
  return {
    ...contactToVars(contact),
    ownerName: contact.owner ?? ownerFallback,
  };
}

export function PreviewTab({
  steps,
  contacts,
  defaultOwnerName = "",
}: {
  steps: SequenceStep[];
  contacts: PreviewContact[];
  defaultOwnerName?: string;
}) {
  const [selectedId, setSelectedId] = useState<number | null>(
    contacts.length > 0 ? contacts[0].id : null
  );
  const [sheetOpen, setSheetOpen] = useState(false);

  const selectedContact = contacts.find((c) => c.id === selectedId) ?? null;
  const vars = buildVars(selectedContact, defaultOwnerName);

  return (
    <div className="space-y-5">
      {/* Contact picker */}
      <div className="flex min-w-0 flex-wrap items-center gap-3 rounded-xl border border-[--line-1] bg-[--surface-1] px-4 py-3">
        <span className="shrink-0 text-xs font-medium text-[--ink-2]">
          Preview as:
        </span>
        {contacts.length === 0 ? (
          <span className="text-xs italic text-[--ink-3]">
            No contacts enrolled — showing labelled placeholders
          </span>
        ) : (
          <>
            {/* Desktop: native select */}
            <select
              value={selectedId ?? ""}
              onChange={(e) => setSelectedId(Number(e.target.value))}
              className="tap hidden max-w-full rounded-[--r-md] border border-[--line-1] bg-[--surface-2] px-3 text-body text-[--ink-1] focus:border-[--accent] focus:outline-none [color-scheme:dark] lg:block"
            >
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.email ? ` (${c.email})` : ""}
                </option>
              ))}
            </select>

            {/* Mobile: action-sheet trigger */}
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              aria-label="Preview as contact"
              className="tap flex min-w-0 max-w-full items-center gap-1.5 rounded-[--r-md] border border-[--line-1] bg-[--surface-2] px-3 text-body text-[--ink-1] transition-colors hover:bg-[--surface-1] focus:border-[--accent] focus:outline-none lg:hidden"
            >
              <span className="truncate">
                {selectedContact?.name ?? "Select contact"}
              </span>
              <span className="shrink-0 text-[--ink-3]">▾</span>
            </button>
          </>
        )}
      </div>

      <MobileActionSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Preview as"
      >
        <div className="flex max-h-[60dvh] flex-col gap-1 overflow-y-auto">
          {contacts.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setSelectedId(c.id);
                setSheetOpen(false);
              }}
              className={`tap flex min-h-[44px] w-full min-w-0 flex-col items-start justify-center rounded-lg px-3 text-left transition-colors ${
                c.id === selectedId
                  ? "bg-[--surface-1] text-[--ink-1]"
                  : "text-[--ink-2] hover:bg-[--surface-1]"
              }`}
            >
              <span className="w-full truncate text-sm font-medium">
                {c.name}
              </span>
              {c.email && (
                <span className="w-full truncate text-xs text-[--ink-3]">
                  {c.email}
                </span>
              )}
            </button>
          ))}
        </div>
      </MobileActionSheet>

      {/* Variable resolution table */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {VAR_LABELS.map(({ key, label, token }) => {
          const value = vars[key];
          const isPlaceholder = value === PLACEHOLDER_VARS[key];
          return (
            <div
              key={key}
              className="rounded-lg border border-[--line-1] bg-[--surface-1] px-3 py-2"
            >
              <p className="mb-0.5 text-xs font-mono text-[--accent]">{token}</p>
              <p
                className={`truncate text-sm ${
                  isPlaceholder ? "italic text-[--ink-3]" : "text-[--ink-1]"
                }`}
              >
                {value}
              </p>
              <p className="text-xs text-[--ink-3]">{label}</p>
            </div>
          );
        })}
      </div>

      {/* Step previews */}
      {steps.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[--line-1] bg-[--surface-1]/50 px-6 py-10 text-center">
          <p className="text-sm text-[--ink-3]">No steps to preview.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {steps.map((step) => (
            <div
              key={step.id}
              className="rounded-xl border border-[--line-1] bg-[--surface-1] p-5"
            >
              <div className="mb-3 flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[--accent-tint] text-xs font-semibold text-[--accent]">
                  {step.position}
                </span>
                <span className="text-xs text-[--ink-3]">
                  {step.delayDays === 0
                    ? "Send immediately"
                    : `Send after ${step.delayDays} day${step.delayDays === 1 ? "" : "s"}`}
                </span>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="mb-0.5 text-xs font-medium text-[--ink-3]">
                    Subject
                  </p>
                  <p className="text-sm text-[--ink-1]">
                    {interpolate(step.subjectTemplate, vars)}
                  </p>
                </div>
                <div>
                  <p className="mb-0.5 text-xs font-medium text-[--ink-3]">
                    Body
                  </p>
                  <p className="whitespace-pre-wrap text-sm text-[--ink-2] break-words overflow-x-hidden">
                    {interpolate(step.bodyTemplate, vars)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
