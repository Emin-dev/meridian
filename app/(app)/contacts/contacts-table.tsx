"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Contact, Sequence } from "@/db/schema";
import type { LastContactedMap } from "./types";
import LeadScoreBadge from "./lead-score-badge";
import { tagColor } from "./tag-color";
import { bulkChangeStatus, bulkAddTag, bulkEnrollInSequence, bulkChangeOwner } from "./actions";
import { ContactsViewSwitcher, type ContactsView } from "./contacts-view-switcher";
import MobileActionSheet from "@/components/mobile-action-sheet";

function getLastContactedMeta(dateStr: string | null): { text: string; dotClass: string } | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  const dotClass =
    diffDays < 7
      ? "bg-emerald-400"
      : diffDays <= 30
        ? "bg-amber-400"
        : "bg-red-400";
  const sameYear = date.getFullYear() === now.getFullYear();
  const text = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  return { text, dotClass };
}

const SOURCE_LABELS: Record<string, string> = {
  website: "Website",
  referral: "Referral",
  linkedin: "LinkedIn",
  "cold-outreach": "Cold Outreach",
  other: "Other",
};

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  lead: { label: "Lead", className: "bg-blue-500/10 text-blue-400" },
  active: { label: "Active", className: "bg-emerald-500/10 text-emerald-400" },
  inactive: { label: "Inactive", className: "bg-[--surface-2] text-[--ink-2]" },
  churned: { label: "Churned", className: "bg-red-500/10 text-red-400" },
};

const STATUSES = [
  { value: "lead", label: "Lead" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "churned", label: "Churned" },
] as const;

type ContactStatus = (typeof STATUSES)[number]["value"];

function SortableHeader({
  col,
  label,
  currentSort,
  currentDir,
  allSearchParams,
  className,
}: {
  col: string;
  label: string;
  currentSort: string;
  currentDir: string;
  allSearchParams: Record<string, string>;
  className?: string;
}) {
  const router = useRouter();
  const isActive = currentSort === col;
  const nextDir = isActive && currentDir === "asc" ? "desc" : "asc";

  function handleClick() {
    const params = new URLSearchParams(allSearchParams);
    params.set("sort", col);
    params.set("dir", nextDir);
    router.push(`/contacts?${params.toString()}`);
  }

  return (
    <th
      onClick={handleClick}
      className={`cursor-pointer select-none px-4 py-3 text-xs font-medium uppercase tracking-wide text-[--ink-3] hover:text-[--ink-1] whitespace-nowrap${className ? ` ${className}` : ""}`}
    >
      <span className="flex items-center gap-1">
        {label}
        {isActive ? (
          currentDir === "asc" ? (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[--accent]">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[--accent]">
              <path d="M12 5v14M5 12l7 7 7-7" />
            </svg>
          )
        ) : (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-30">
            <path d="M8 9l4-4 4 4M16 15l-4 4-4-4" />
          </svg>
        )}
      </span>
    </th>
  );
}

function ContactCards({
  contacts,
  selectMode = false,
  selectedIds,
  onToggle,
}: {
  contacts: Contact[];
  selectMode?: boolean;
  selectedIds?: Set<number>;
  onToggle?: (id: number) => void;
}) {
  return (
    <div className="divide-y divide-[--line-1]">
      {contacts.map((c) => {
        const statusMeta = c.status ? STATUS_LABELS[c.status] : null;
        const secondary = [
          c.company,
          statusMeta?.label,
          c.leadScore != null ? String(c.leadScore) : null,
        ]
          .filter(Boolean)
          .join(" • ");
        const isSelected = selectedIds?.has(c.id) ?? false;

        const body = (
          <>
            {selectMode && (
              <input
                type="checkbox"
                checked={isSelected}
                readOnly
                tabIndex={-1}
                aria-hidden
                className="pointer-events-none h-4 w-4 flex-shrink-0 rounded border-[--line-2] accent-[--accent]"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[--ink-1]">{c.name}</p>
              {secondary && (
                <p className="truncate text-xs text-[--ink-2]">{secondary}</p>
              )}
            </div>
            {!selectMode && (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="flex-shrink-0 text-[--ink-3]"
                aria-hidden
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            )}
          </>
        );

        if (selectMode) {
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onToggle?.(c.id)}
              aria-pressed={isSelected}
              aria-label={`Select ${c.name}`}
              className={`flex min-h-[44px] w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                isSelected
                  ? "bg-[--accent-tint]"
                  : "hover:bg-[--surface-2]/40 active:bg-[--surface-2]/60"
              }`}
            >
              {body}
            </button>
          );
        }

        return (
          <Link
            key={c.id}
            href={`/contacts/${c.id}`}
            className="flex min-h-[44px] items-center gap-3 px-4 py-3 transition-colors hover:bg-[--surface-2]/40 active:bg-[--surface-2]/60"
          >
            {body}
          </Link>
        );
      })}
    </div>
  );
}

type Props = {
  contacts: Contact[];
  sequences: Sequence[];
  hasActiveFilters: boolean;
  lastContactedMap: LastContactedMap;
  hasDb: boolean;
  sort: string;
  dir: string;
  allSearchParams: Record<string, string>;
  view: ContactsView;
};

export default function ContactsTable({ contacts, sequences, hasActiveFilters, lastContactedMap, hasDb, sort, dir, allSearchParams, view }: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [statusSelect, setStatusSelect] = useState<ContactStatus>("lead");
  const [sequenceSelect, setSequenceSelect] = useState("");
  const [ownerInput, setOwnerInput] = useState("");
  const [feedback, setFeedback] = useState<{ msg: string; ok: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();

  const allIds = contacts.map((c) => c.id);
  const allSelected = selectedIds.size === allIds.length && allIds.length > 0;
  const someSelected = selectedIds.size > 0;

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  }

  function toggle(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSheetOpen(false);
    setSelectedIds(new Set());
  }

  function flash(msg: string, ok = true) {
    setFeedback({ msg, ok });
    setTimeout(() => setFeedback(null), 3000);
  }

  function handleChangeStatus() {
    startTransition(async () => {
      const result = await bulkChangeStatus(Array.from(selectedIds), statusSelect);
      if (result.error) flash(result.error, false);
      else flash(`Updated status for ${result.count} contact(s).`);
      setSelectedIds(new Set());
      setSheetOpen(false);
      setSelectMode(false);
    });
  }

  function handleAddTag() {
    if (!tagInput.trim()) return;
    startTransition(async () => {
      const result = await bulkAddTag(Array.from(selectedIds), tagInput.trim());
      if (result.error) flash(result.error, false);
      else flash(`Added tag to ${result.count} contact(s).`);
      setTagInput("");
      setSelectedIds(new Set());
      setSheetOpen(false);
      setSelectMode(false);
    });
  }

  function handleChangeOwner() {
    startTransition(async () => {
      const result = await bulkChangeOwner(Array.from(selectedIds), ownerInput);
      if (result.error) flash(result.error, false);
      else flash(`Updated owner for ${result.count} contact(s).`);
      setOwnerInput("");
      setSelectedIds(new Set());
      setSheetOpen(false);
      setSelectMode(false);
    });
  }

  function handleEnrollSequence() {
    if (!sequenceSelect) return;
    startTransition(async () => {
      const result = await bulkEnrollInSequence(
        Array.from(selectedIds),
        parseInt(sequenceSelect)
      );
      if (result.error) flash(result.error, false);
      else flash(`Enrolled ${result.count} contact(s) in sequence.`);
      setSequenceSelect("");
      setSelectedIds(new Set());
      setSheetOpen(false);
      setSelectMode(false);
    });
  }

  return (
    <div className="space-y-3">
      {/* Bulk action bar — desktop table view only (mobile uses the action sheet) */}
      {someSelected && view === "table" && (
        <div className="sticky top-0 z-30 hidden flex-wrap items-center gap-2 rounded-lg border border-[--accent]/30 bg-[--accent-tint] px-4 py-2 shadow-sm shadow-black/20 backdrop-blur lg:flex">
          <span className="flex min-h-[44px] items-center text-sm font-medium text-[--accent]">
            {selectedIds.size} selected
          </span>

          {/* Change status */}
          <div className="flex items-center gap-1.5">
            <select
              aria-label="Set status for selected contacts"
              value={statusSelect}
              onChange={(e) => setStatusSelect(e.target.value as ContactStatus)}
              className="tap rounded border border-[--line-1] bg-[--surface-1] px-2 text-xs text-[--ink-1]"
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <button
              onClick={handleChangeStatus}
              disabled={isPending}
              className="tap flex items-center justify-center rounded bg-[--surface-2] px-2.5 text-xs font-medium text-[--ink-1] hover:bg-[--surface-3] disabled:opacity-50"
            >
              Set status
            </button>
          </div>

          {/* Add tag */}
          <div className="flex items-center gap-1.5">
            <input
              aria-label="Tag to add"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
              placeholder="Tag name"
              className="tap w-full rounded border border-[--line-1] bg-[--surface-1] px-2 text-xs text-[--ink-1] placeholder-[--ink-3] focus:outline-none focus:ring-1 focus:ring-[--accent] sm:w-32"
            />
            <button
              onClick={handleAddTag}
              disabled={isPending || !tagInput.trim()}
              className="tap flex items-center justify-center rounded bg-[--surface-2] px-2.5 text-xs font-medium text-[--ink-1] hover:bg-[--surface-3] disabled:opacity-50"
            >
              Add tag
            </button>
          </div>

          {/* Change owner */}
          <div className="flex items-center gap-1.5">
            <input
              aria-label="New owner name"
              value={ownerInput}
              onChange={(e) => setOwnerInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleChangeOwner()}
              placeholder="Owner name"
              className="tap w-full rounded border border-[--line-1] bg-[--surface-1] px-2 text-xs text-[--ink-1] placeholder-[--ink-3] focus:outline-none focus:ring-1 focus:ring-[--accent] sm:w-32"
            />
            <button
              onClick={handleChangeOwner}
              disabled={isPending}
              className="tap flex items-center justify-center rounded bg-[--surface-2] px-2.5 text-xs font-medium text-[--ink-1] hover:bg-[--surface-3] disabled:opacity-50"
            >
              Set owner
            </button>
          </div>

          {sequences.length > 0 && (
            <div className="flex items-center gap-1.5">
              <select
                aria-label="Enroll selected contacts in sequence"
                value={sequenceSelect}
                onChange={(e) => setSequenceSelect(e.target.value)}
                className="tap rounded border border-[--line-1] bg-[--surface-1] px-2 text-xs text-[--ink-1]"
              >
                <option value="">Pick sequence…</option>
                {sequences.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.name}
                  </option>
                ))}
              </select>
              <button
                onClick={handleEnrollSequence}
                disabled={isPending || !sequenceSelect}
                className="tap flex items-center justify-center rounded bg-[--surface-2] px-2.5 text-xs font-medium text-[--ink-1] hover:bg-[--surface-3] disabled:opacity-50"
              >
                Enroll
              </button>
            </div>
          )}

          <div className="ml-auto flex items-center gap-3">
            {feedback && (
              <span
                className={`text-xs ${feedback.ok ? "text-emerald-400" : "text-red-400"}`}
              >
                {feedback.msg}
              </span>
            )}
            <button
              onClick={() => setSelectedIds(new Set())}
              className="tap flex items-center justify-center text-xs text-[--ink-3] hover:text-[--ink-1]"
            >
              Clear selection
            </button>
          </div>
        </div>
      )}

      {/* Table / Card container */}
      <div className="rounded-xl border border-[--line-1] bg-[--surface-1]">
        {/* Header row */}
        <div className="flex items-center justify-between border-b border-[--line-1] px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-[--ink-3]">
            {hasActiveFilters ? "Filtered contacts" : "All Contacts"}
            {hasActiveFilters && (
              <span className="ml-2 normal-case">
                — {contacts.length} result{contacts.length !== 1 ? "s" : ""}
              </span>
            )}
          </p>
          {/* View switcher — desktop only; mobile is always stacked cards */}
          <div className="hidden lg:block">
            <ContactsViewSwitcher currentView={view} allSearchParams={allSearchParams} />
          </div>
        </div>

        {/* Mobile: always stacked cards (the wide table would horizontal-scroll) */}
        <div className="lg:hidden">
          {/* Mobile select toolbar */}
          <div className="flex items-center gap-3 border-b border-[--line-1] px-4 py-2">
            {selectMode ? (
              <>
                <label className="tap flex cursor-pointer items-center gap-2 text-xs font-medium text-[--ink-1]">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected && !allSelected;
                    }}
                    onChange={toggleAll}
                    aria-label="Select all contacts"
                    className="h-4 w-4 cursor-pointer rounded border-[--line-2] accent-[--accent]"
                  />
                  {selectedIds.size > 0 ? `${selectedIds.size} selected` : "Select all"}
                </label>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={() => setSheetOpen(true)}
                    disabled={!someSelected}
                    className="tap flex items-center justify-center rounded-lg bg-[--accent] px-3 text-xs font-medium text-[--accent-ink] hover:bg-[--accent-hover] disabled:opacity-40"
                  >
                    Actions
                  </button>
                  <button
                    onClick={exitSelectMode}
                    className="tap flex items-center justify-center text-xs text-[--ink-2] hover:text-[--ink-1]"
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <button
                onClick={() => setSelectMode(true)}
                className="tap ml-auto flex items-center justify-center text-xs font-medium text-[--ink-2] hover:text-[--ink-1]"
              >
                Select
              </button>
            )}
          </div>

          {feedback && (
            <div
              className={`border-b border-[--line-1] px-4 py-2 text-xs ${
                feedback.ok ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {feedback.msg}
            </div>
          )}

          <ContactCards
            contacts={contacts}
            selectMode={selectMode}
            selectedIds={selectedIds}
            onToggle={toggle}
          />
        </div>

        {/* Desktop card view */}
        {view === "cards" && (
          <div className="hidden lg:block">
            <ContactCards contacts={contacts} />
          </div>
        )}

        {/* Desktop table view */}
        {view === "table" && (
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[--line-1] text-left">
                  <th className="px-3 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someSelected && !allSelected;
                      }}
                      onChange={toggleAll}
                      aria-label="Select all contacts"
                      className="h-4 w-4 cursor-pointer rounded border-[--line-2] accent-[--accent]"
                    />
                  </th>
                  <SortableHeader
                    col="name"
                    label="Name"
                    currentSort={sort}
                    currentDir={dir}
                    allSearchParams={allSearchParams}
                    className="sticky left-0 z-10 bg-[--surface-1]"
                  />
                  <SortableHeader col="status" label="Status" currentSort={sort} currentDir={dir} allSearchParams={allSearchParams} />
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-[--ink-3]">
                    Email
                  </th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-[--ink-3]">
                    Phone
                  </th>
                  <SortableHeader col="company" label="Company" currentSort={sort} currentDir={dir} allSearchParams={allSearchParams} />
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-[--ink-3]">
                    Title
                  </th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-[--ink-3]">
                    Source
                  </th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-[--ink-3]">
                    Owner
                  </th>
                  <SortableHeader col="leadScore" label="Score" currentSort={sort} currentDir={dir} allSearchParams={allSearchParams} />
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-[--ink-3]">
                    Tags
                  </th>
                  {hasDb && (
                    <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-[--ink-3]">
                      Last contact
                    </th>
                  )}
                  <SortableHeader col="createdAt" label="Created" currentSort={sort} currentDir={dir} allSearchParams={allSearchParams} />
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => {
                  const statusMeta = c.status ? STATUS_LABELS[c.status] : null;
                  const isSelected = selectedIds.has(c.id);
                  return (
                    <tr
                      key={c.id}
                      className={`border-b border-[--line-1] last:border-0 transition-colors ${
                        isSelected ? "bg-[--accent-tint]" : "hover:bg-[--surface-2]/40"
                      }`}
                    >
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggle(c.id)}
                          aria-label={`Select ${c.name}`}
                          className="h-4 w-4 cursor-pointer rounded border-[--line-2] accent-[--accent]"
                        />
                      </td>
                      <td className={`sticky left-0 z-10 px-4 py-3 font-medium text-[--ink-1] ${isSelected ? "bg-[--accent-tint]" : "bg-[--surface-1]"}`}>
                        <Link
                          href={`/contacts/${c.id}`}
                          className="hover:text-[--accent] transition-colors"
                        >
                          {c.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        {statusMeta ? (
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusMeta.className}`}
                          >
                            {statusMeta.label}
                          </span>
                        ) : (
                          <span className="text-[--ink-3]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[--ink-2]">{c.email ?? "—"}</td>
                      <td className="px-4 py-3 text-[--ink-2]">{c.phone ?? "—"}</td>
                      <td className="px-4 py-3 text-[--ink-2]">{c.company ?? "—"}</td>
                      <td className="px-4 py-3 text-[--ink-2]">{c.title ?? "—"}</td>
                      <td className="px-4 py-3 text-[--ink-2]">
                        {c.source ? SOURCE_LABELS[c.source] ?? c.source : "—"}
                      </td>
                      <td className="px-4 py-3 text-[--ink-2]">{c.owner ?? "—"}</td>
                      <td className="px-4 py-3">
                        {c.leadScore != null ? (
                          <LeadScoreBadge score={c.leadScore} />
                        ) : (
                          <span className="text-[--ink-3]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {(c.tags ?? []).length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {(c.tags ?? []).map((t) => (
                              <span
                                key={t}
                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${tagColor(t)}`}
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[--ink-3]">—</span>
                        )}
                      </td>
                      {hasDb && (() => {
                        const meta = getLastContactedMeta(lastContactedMap[c.id] ?? null);
                        return (
                          <td className="px-4 py-3 whitespace-nowrap">
                            {meta ? (
                              <span className="flex items-center gap-1.5">
                                <span className={`h-2 w-2 flex-shrink-0 rounded-full ${meta.dotClass}`} />
                                <span className="text-xs text-[--ink-2]">{meta.text}</span>
                              </span>
                            ) : (
                              <span className="text-[--ink-3]">—</span>
                            )}
                          </td>
                        );
                      })()}
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-[--ink-3]">
                        {c.createdAt
                          ? new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Mobile bulk-action sheet — mirrors the desktop bulk bar */}
      <MobileActionSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={`${selectedIds.size} selected`}
      >
        <div className="flex flex-col gap-3">
          {/* Change status */}
          <div className="flex items-center gap-2">
            <select
              aria-label="Set status for selected contacts"
              value={statusSelect}
              onChange={(e) => setStatusSelect(e.target.value as ContactStatus)}
              className="tap min-w-0 flex-1 rounded-lg border border-[--line-1] bg-[--surface-1] px-3 text-sm text-[--ink-1]"
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <button
              onClick={handleChangeStatus}
              disabled={isPending}
              className="tap flex shrink-0 items-center justify-center rounded-lg bg-[--surface-2] px-4 text-sm font-medium text-[--ink-1] hover:bg-[--surface-3] disabled:opacity-50"
            >
              Set status
            </button>
          </div>

          {/* Add tag */}
          <div className="flex items-center gap-2">
            <input
              aria-label="Tag to add"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
              placeholder="Tag name"
              className="tap min-w-0 flex-1 rounded-lg border border-[--line-1] bg-[--surface-1] px-3 text-sm text-[--ink-1] placeholder-[--ink-3] focus:outline-none focus:ring-1 focus:ring-[--accent]"
            />
            <button
              onClick={handleAddTag}
              disabled={isPending || !tagInput.trim()}
              className="tap flex shrink-0 items-center justify-center rounded-lg bg-[--surface-2] px-4 text-sm font-medium text-[--ink-1] hover:bg-[--surface-3] disabled:opacity-50"
            >
              Add tag
            </button>
          </div>

          {/* Change owner */}
          <div className="flex items-center gap-2">
            <input
              aria-label="New owner name"
              value={ownerInput}
              onChange={(e) => setOwnerInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleChangeOwner()}
              placeholder="Owner name"
              className="tap min-w-0 flex-1 rounded-lg border border-[--line-1] bg-[--surface-1] px-3 text-sm text-[--ink-1] placeholder-[--ink-3] focus:outline-none focus:ring-1 focus:ring-[--accent]"
            />
            <button
              onClick={handleChangeOwner}
              disabled={isPending}
              className="tap flex shrink-0 items-center justify-center rounded-lg bg-[--surface-2] px-4 text-sm font-medium text-[--ink-1] hover:bg-[--surface-3] disabled:opacity-50"
            >
              Set owner
            </button>
          </div>

          {/* Enroll in sequence */}
          {sequences.length > 0 && (
            <div className="flex items-center gap-2">
              <select
                aria-label="Enroll selected contacts in sequence"
                value={sequenceSelect}
                onChange={(e) => setSequenceSelect(e.target.value)}
                className="tap min-w-0 flex-1 rounded-lg border border-[--line-1] bg-[--surface-1] px-3 text-sm text-[--ink-1]"
              >
                <option value="">Pick sequence…</option>
                {sequences.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.name}
                  </option>
                ))}
              </select>
              <button
                onClick={handleEnrollSequence}
                disabled={isPending || !sequenceSelect}
                className="tap flex shrink-0 items-center justify-center rounded-lg bg-[--surface-2] px-4 text-sm font-medium text-[--ink-1] hover:bg-[--surface-3] disabled:opacity-50"
              >
                Enroll
              </button>
            </div>
          )}
        </div>
      </MobileActionSheet>
    </div>
  );
}
