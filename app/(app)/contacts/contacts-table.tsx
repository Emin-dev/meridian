"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Sequence } from "@/db/schema";
import type { LastContactedMap, ContactListItem } from "./types";
import LeadScoreBadge from "./lead-score-badge";
import { tagColor } from "./tag-color";
import { bulkChangeStatus, bulkAddTag, bulkEnrollInSequence, bulkChangeOwner } from "./actions";
import { ContactsViewSwitcher, type ContactsView } from "./contacts-view-switcher";
import MobileActionSheet from "@/components/mobile-action-sheet";
import DetailField from "@/components/detail-field";
import { formatShortDate } from "@/lib/format";
import {
  SOURCE_LABELS,
  STATUS_LABELS,
  CONTACT_STATUSES,
  type ContactStatus,
} from "./constants";

function getLastContactedMeta(dateStr: string | null): { text: string; dotClass: string } | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  const dotClass =
    diffDays < 7
      ? "bg-[var(--ok)]"
      : diffDays <= 30
        ? "bg-[var(--warn)]"
        : "bg-[var(--bad)]";
  const sameYear = date.getFullYear() === now.getFullYear();
  const text = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  return { text, dotClass };
}

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
      className={`cursor-pointer select-none px-4 py-3 text-xs font-medium uppercase tracking-wide text-[var(--ink-3)] hover:text-[var(--ink-1)] whitespace-nowrap${className ? ` ${className}` : ""}`}
    >
      <span className="flex items-center gap-1">
        {label}
        {isActive ? (
          currentDir === "asc" ? (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--accent)]">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--accent)]">
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
  onCardTap,
}: {
  contacts: ContactListItem[];
  selectMode?: boolean;
  selectedIds?: Set<number>;
  onToggle?: (id: number) => void;
  /** When provided, tapping a row opens it in-place (mobile sheet) instead of navigating. */
  onCardTap?: (c: ContactListItem) => void;
}) {
  return (
    <div className="anim-stagger divide-y divide-[var(--line-1)]">
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
                className="pointer-events-none h-4 w-4 flex-shrink-0 rounded border-[var(--line-2)] accent-[var(--accent)]"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[var(--ink-1)]">{c.name}</p>
              {secondary && (
                <p className="truncate text-xs text-[var(--ink-2)]">{secondary}</p>
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
                className="flex-shrink-0 text-[var(--ink-3)]"
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
                  ? "bg-[var(--accent-tint)]"
                  : "hover:bg-[var(--surface-2)]/40 active:bg-[var(--surface-2)]/60"
              }`}
            >
              {body}
            </button>
          );
        }

        if (onCardTap) {
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onCardTap(c)}
              aria-label={`View ${c.name} details`}
              className="flex min-h-[44px] w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--surface-2)]/40 active:bg-[var(--surface-2)]/60"
            >
              {body}
            </button>
          );
        }

        return (
          <Link
            key={c.id}
            href={`/contacts/${c.id}`}
            className="flex min-h-[44px] items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--surface-2)]/40 active:bg-[var(--surface-2)]/60"
          >
            {body}
          </Link>
        );
      })}
    </div>
  );
}

type Props = {
  contacts: ContactListItem[];
  sequences: Sequence[];
  hasActiveFilters: boolean;
  lastContactedMap: LastContactedMap;
  hasDb: boolean;
  sort: string;
  dir: string;
  allSearchParams: Record<string, string>;
  view: ContactsView;
  page: number;
  hasMore: boolean;
};

export default function ContactsTable({ contacts, sequences, hasActiveFilters, lastContactedMap, hasDb, sort, dir, allSearchParams, view, page, hasMore }: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Mobile-only: which contact's quick-view detail is open in the bottom sheet.
  const [detailContact, setDetailContact] = useState<ContactListItem | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [statusSelect, setStatusSelect] = useState<ContactStatus>("lead");
  const [sequenceSelect, setSequenceSelect] = useState("");
  const [ownerInput, setOwnerInput] = useState("");
  const [feedback, setFeedback] = useState<{ msg: string; ok: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();

  // "Load more" grows the visible window by one page, preserving the active
  // filters, sort, and view. allSearchParams carries the filters; sort/dir/view
  // are added back explicitly so the next page keeps the same ordering.
  const loadMoreParams = new URLSearchParams(allSearchParams);
  loadMoreParams.set("sort", sort);
  loadMoreParams.set("dir", dir);
  if (view === "cards") loadMoreParams.set("view", "cards");
  loadMoreParams.set("page", String(page + 1));
  const loadMoreHref = `/contacts?${loadMoreParams.toString()}`;

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

  function applyStatus(status: ContactStatus) {
    startTransition(async () => {
      const result = await bulkChangeStatus(Array.from(selectedIds), status);
      if (result.error) flash(result.error, false);
      else flash(`Updated status for ${result.count} contact(s).`);
      setSelectedIds(new Set());
      setSheetOpen(false);
      setSelectMode(false);
    });
  }

  function handleChangeStatus() {
    applyStatus(statusSelect);
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

  function applyEnroll(sequenceId: number) {
    startTransition(async () => {
      const result = await bulkEnrollInSequence(
        Array.from(selectedIds),
        sequenceId
      );
      if (result.error) flash(result.error, false);
      else flash(`Enrolled ${result.count} contact(s) in sequence.`);
      setSequenceSelect("");
      setSelectedIds(new Set());
      setSheetOpen(false);
      setSelectMode(false);
    });
  }

  function handleEnrollSequence() {
    if (!sequenceSelect) return;
    applyEnroll(parseInt(sequenceSelect));
  }

  return (
    <div className="space-y-3">
      {/* Bulk action bar — desktop table view only (mobile uses the action sheet) */}
      {someSelected && view === "table" && (
        <div className="sticky top-0 z-30 hidden flex-wrap items-center gap-2 rounded-lg border border-[var(--accent)]/30 bg-[var(--accent-tint)] px-4 py-2 shadow-sm shadow-black/20 backdrop-blur lg:flex">
          <span className="flex min-h-[44px] items-center text-sm font-medium text-[var(--accent)]">
            {selectedIds.size} selected
          </span>

          {/* Change status */}
          <div className="flex items-center gap-1.5">
            <select
              aria-label="Set status for selected contacts"
              value={statusSelect}
              onChange={(e) => setStatusSelect(e.target.value as ContactStatus)}
              className="tap rounded border border-[var(--line-1)] bg-[var(--surface-1)] px-2 text-xs text-[var(--ink-1)]"
            >
              {CONTACT_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <button
              onClick={handleChangeStatus}
              disabled={isPending}
              className="tap flex items-center justify-center rounded bg-[var(--surface-2)] px-2.5 text-xs font-medium text-[var(--ink-1)] hover:bg-[var(--surface-3)] disabled:opacity-50"
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
              className="tap w-full rounded border border-[var(--line-1)] bg-[var(--surface-1)] px-2 text-xs text-[var(--ink-1)] placeholder-[var(--ink-3)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] sm:w-32"
            />
            <button
              onClick={handleAddTag}
              disabled={isPending || !tagInput.trim()}
              className="tap flex items-center justify-center rounded bg-[var(--surface-2)] px-2.5 text-xs font-medium text-[var(--ink-1)] hover:bg-[var(--surface-3)] disabled:opacity-50"
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
              className="tap w-full rounded border border-[var(--line-1)] bg-[var(--surface-1)] px-2 text-xs text-[var(--ink-1)] placeholder-[var(--ink-3)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] sm:w-32"
            />
            <button
              onClick={handleChangeOwner}
              disabled={isPending}
              className="tap flex items-center justify-center rounded bg-[var(--surface-2)] px-2.5 text-xs font-medium text-[var(--ink-1)] hover:bg-[var(--surface-3)] disabled:opacity-50"
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
                className="tap rounded border border-[var(--line-1)] bg-[var(--surface-1)] px-2 text-xs text-[var(--ink-1)]"
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
                className="tap flex items-center justify-center rounded bg-[var(--surface-2)] px-2.5 text-xs font-medium text-[var(--ink-1)] hover:bg-[var(--surface-3)] disabled:opacity-50"
              >
                Enroll
              </button>
            </div>
          )}

          <div className="ml-auto flex items-center gap-3">
            {feedback && (
              <span
                className={`text-xs ${feedback.ok ? "text-[var(--ok)]" : "text-[var(--bad)]"}`}
              >
                {feedback.msg}
              </span>
            )}
            <button
              onClick={() => setSelectedIds(new Set())}
              className="tap flex items-center justify-center text-xs text-[var(--ink-3)] hover:text-[var(--ink-1)]"
            >
              Clear selection
            </button>
          </div>
        </div>
      )}

      {/* Table / Card container — edge-to-edge grouped-list on phones, boxed table from sm up */}
      <div className="border-y border-[var(--line-1)] bg-[var(--surface-1)] sm:rounded-xl sm:border">
        {/* Header row */}
        <div className="flex items-center justify-between border-b border-[var(--line-1)] px-5 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--ink-3)]">
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
          <div className="flex items-center gap-3 px-4 py-2 sm:border-b sm:border-[var(--line-1)]">
            {selectMode ? (
              <>
                <label className="tap flex cursor-pointer items-center gap-2 text-xs font-medium text-[var(--ink-1)]">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected && !allSelected;
                    }}
                    onChange={toggleAll}
                    aria-label="Select all contacts"
                    className="h-4 w-4 cursor-pointer rounded border-[var(--line-2)] accent-[var(--accent)]"
                  />
                  {selectedIds.size > 0 ? `${selectedIds.size} selected` : "Select all"}
                </label>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={() => setSheetOpen(true)}
                    disabled={!someSelected}
                    className="tap flex items-center justify-center rounded-lg bg-[var(--accent)] px-3 text-xs font-medium text-[var(--accent-ink)] hover:bg-[var(--accent-hover)] disabled:opacity-40"
                  >
                    Actions
                  </button>
                  <button
                    onClick={exitSelectMode}
                    className="tap flex items-center justify-center text-xs text-[var(--ink-2)] hover:text-[var(--ink-1)]"
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <button
                onClick={() => setSelectMode(true)}
                className="tap ml-auto flex items-center justify-center text-xs font-medium text-[var(--ink-3)] hover:text-[var(--ink-1)]"
              >
                Select
              </button>
            )}
          </div>

          {feedback && (
            <div
              className={`border-b border-[var(--line-1)] px-4 py-2 text-xs ${
                feedback.ok ? "text-[var(--ok)]" : "text-[var(--bad)]"
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
            onCardTap={setDetailContact}
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
            <table className="w-full min-w-[1100px] text-sm">
              <thead>
                <tr className="border-b border-[var(--line-1)] text-left">
                  <th className="sticky left-0 z-10 bg-[var(--surface-1)] px-3 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someSelected && !allSelected;
                      }}
                      onChange={toggleAll}
                      aria-label="Select all contacts"
                      className="h-4 w-4 cursor-pointer rounded border-[var(--line-2)] accent-[var(--accent)]"
                    />
                  </th>
                  <SortableHeader
                    col="name"
                    label="Name"
                    currentSort={sort}
                    currentDir={dir}
                    allSearchParams={allSearchParams}
                    className="sticky left-10 z-10 bg-[var(--surface-1)]"
                  />
                  <SortableHeader col="status" label="Status" currentSort={sort} currentDir={dir} allSearchParams={allSearchParams} />
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-[var(--ink-3)]">
                    Email
                  </th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-[var(--ink-3)]">
                    Phone
                  </th>
                  <SortableHeader col="company" label="Company" currentSort={sort} currentDir={dir} allSearchParams={allSearchParams} />
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-[var(--ink-3)]">
                    Title
                  </th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-[var(--ink-3)]">
                    Source
                  </th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-[var(--ink-3)]">
                    Owner
                  </th>
                  <SortableHeader col="leadScore" label="Score" currentSort={sort} currentDir={dir} allSearchParams={allSearchParams} />
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-[var(--ink-3)]">
                    Tags
                  </th>
                  {hasDb && (
                    <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-[var(--ink-3)]">
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
                      className={`border-b border-[var(--line-1)] last:border-0 transition-colors ${
                        isSelected ? "bg-[var(--accent-tint)]" : "hover:bg-[var(--surface-2)]/40"
                      }`}
                    >
                      <td className={`sticky left-0 z-10 px-3 py-3 ${isSelected ? "bg-[var(--accent-tint)]" : "bg-[var(--surface-1)]"}`}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggle(c.id)}
                          aria-label={`Select ${c.name}`}
                          className="h-4 w-4 cursor-pointer rounded border-[var(--line-2)] accent-[var(--accent)]"
                        />
                      </td>
                      <td className={`sticky left-0 z-10 whitespace-nowrap px-4 py-3 font-medium text-[var(--ink-1)] ${isSelected ? "bg-[var(--accent-tint)]" : "bg-[var(--surface-1)]"}`}>
                        <Link
                          href={`/contacts/${c.id}`}
                          className="hover:text-[var(--accent)] transition-colors"
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
                          <span className="text-[var(--ink-3)]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[var(--ink-2)]">{c.email ?? "—"}</td>
                      <td className="px-4 py-3 text-[var(--ink-2)]">{c.phone ?? "—"}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-[var(--ink-2)]">{c.company ?? "—"}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-[var(--ink-2)]">{c.title ?? "—"}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-[var(--ink-2)]">
                        {c.source ? SOURCE_LABELS[c.source] ?? c.source : "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-[var(--ink-2)]">{c.owner ?? "—"}</td>
                      <td className="px-4 py-3">
                        {c.leadScore != null ? (
                          <LeadScoreBadge score={c.leadScore} />
                        ) : (
                          <span className="text-[var(--ink-3)]">—</span>
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
                          <span className="text-[var(--ink-3)]">—</span>
                        )}
                      </td>
                      {hasDb && (() => {
                        const meta = getLastContactedMeta(lastContactedMap[c.id] ?? null);
                        return (
                          <td className="px-4 py-3 whitespace-nowrap">
                            {meta ? (
                              <span className="flex items-center gap-1.5">
                                <span className={`h-2 w-2 flex-shrink-0 rounded-full ${meta.dotClass}`} />
                                <span className="text-xs text-[var(--ink-2)]">{meta.text}</span>
                              </span>
                            ) : (
                              <span className="text-[var(--ink-3)]">—</span>
                            )}
                          </td>
                        );
                      })()}
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-[var(--ink-3)]">
                        {formatShortDate(c.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Load more — bounded pagination; only shown when another page exists */}
      {hasMore && (
        <div className="flex justify-center">
          <Link
            href={loadMoreHref}
            scroll={false}
            className="tap flex items-center justify-center rounded-lg border border-[var(--line-1)] bg-[var(--surface-1)] px-5 text-sm font-medium text-[var(--ink-1)] transition-colors hover:bg-[var(--surface-2)]"
          >
            Load more
          </Link>
        </div>
      )}

      {/* Mobile bulk-action sheet — mirrors the desktop bulk bar */}
      <MobileActionSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={`${selectedIds.size} selected`}
      >
        <div className="flex flex-col gap-3">
          {/* Change status */}
          <div>
            <p className="mb-1.5 text-caption uppercase tracking-wider text-[var(--ink-3)]">
              Set status
            </p>
            <div className="flex flex-col divide-y divide-[var(--line-1)]">
              {CONTACT_STATUSES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => applyStatus(s.value)}
                  disabled={isPending}
                  className="tap press flex min-h-[44px] items-center gap-3 px-1 text-left text-sm text-[var(--ink-1)] transition-colors hover:text-[var(--accent)] disabled:opacity-40"
                >
                  <span className="flex-1">{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Add tag */}
          <div className="flex items-center gap-2">
            <input
              aria-label="Tag to add"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
              placeholder="Tag name"
              className="min-h-[44px] min-w-0 flex-1 rounded-lg border border-[var(--line-1)] bg-[var(--surface-1)] px-3 text-sm text-[var(--ink-1)] placeholder-[var(--ink-3)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
            <button
              onClick={handleAddTag}
              disabled={isPending || !tagInput.trim()}
              className="tap flex shrink-0 items-center justify-center rounded-lg bg-[var(--surface-2)] px-4 text-sm font-medium text-[var(--ink-1)] hover:bg-[var(--surface-3)] disabled:opacity-50"
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
              className="min-h-[44px] min-w-0 flex-1 rounded-lg border border-[var(--line-1)] bg-[var(--surface-1)] px-3 text-sm text-[var(--ink-1)] placeholder-[var(--ink-3)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
            <button
              onClick={handleChangeOwner}
              disabled={isPending}
              className="tap flex shrink-0 items-center justify-center rounded-lg bg-[var(--surface-2)] px-4 text-sm font-medium text-[var(--ink-1)] hover:bg-[var(--surface-3)] disabled:opacity-50"
            >
              Set owner
            </button>
          </div>

          {/* Enroll in sequence */}
          {sequences.length > 0 && (
            <div>
              <p className="mb-1.5 text-caption uppercase tracking-wider text-[var(--ink-3)]">
                Enroll in sequence
              </p>
              <div className="flex flex-col divide-y divide-[var(--line-1)]">
                {sequences.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => applyEnroll(s.id)}
                    disabled={isPending}
                    className="tap press flex min-h-[44px] items-center gap-3 px-1 text-left text-sm text-[var(--ink-1)] transition-colors hover:text-[var(--accent)] disabled:opacity-40"
                  >
                    <span className="flex-1">{s.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </MobileActionSheet>

      {/* Mobile contact quick-view sheet — tap a row to open */}
      <MobileActionSheet
        open={detailContact !== null}
        onClose={() => setDetailContact(null)}
        title="Contact"
      >
        {detailContact && (() => {
          const statusMeta = detailContact.status ? STATUS_LABELS[detailContact.status] : null;
          const lastContacted = getLastContactedMeta(lastContactedMap[detailContact.id] ?? null);
          const tags = detailContact.tags ?? [];
          return (
            <div className="space-y-4">
              <div>
                <h3 className="text-title3 font-semibold text-[var(--ink-1)]">
                  {detailContact.name}
                </h3>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {statusMeta && (
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusMeta.className}`}
                    >
                      {statusMeta.label}
                    </span>
                  )}
                  {detailContact.leadScore != null && (
                    <LeadScoreBadge score={detailContact.leadScore} />
                  )}
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                <DetailField label="Company" value={detailContact.company ?? "—"} />
                <DetailField label="Title" value={detailContact.title ?? "—"} />
                <DetailField label="Email" value={detailContact.email ?? "—"} />
                <DetailField label="Phone" value={detailContact.phone ?? "—"} />
                <DetailField
                  label="Source"
                  value={detailContact.source ? SOURCE_LABELS[detailContact.source] ?? detailContact.source : "—"}
                />
                <DetailField label="Owner" value={detailContact.owner ?? "—"} />
                {hasDb && (
                  <DetailField label="Last contact" value={lastContacted?.text ?? "Never"} />
                )}
                <DetailField label="Added" value={formatShortDate(detailContact.createdAt)} />
              </dl>

              {tags.length > 0 && (
                <div>
                  <dt className="text-caption uppercase tracking-wider text-[var(--ink-3)]">Tags</dt>
                  <dd className="mt-1.5 flex flex-wrap gap-1">
                    {tags.map((t) => (
                      <span
                        key={t}
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${tagColor(t)}`}
                      >
                        {t}
                      </span>
                    ))}
                  </dd>
                </div>
              )}

              <Link
                href={`/contacts/${detailContact.id}`}
                className="tap flex min-h-[44px] items-center justify-center rounded-lg bg-[var(--accent)] px-4 text-sm font-medium text-[var(--accent-ink)] transition-colors hover:bg-[var(--accent-hover)]"
              >
                Open full contact
              </Link>
            </div>
          );
        })()}
      </MobileActionSheet>
    </div>
  );
}
