"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { bulkMoveStage, bulkChangeOwner, bulkDeleteDeals } from "./actions";
import type { DealWithContact } from "./types";
import MobileActionSheet from "@/components/mobile-action-sheet";
import { STAGES, STAGE_LABELS, STAGE_COLORS } from "./stages";
import { formatCurrency } from "@/lib/format";

type SortKey = "title" | "contact" | "stage" | "value" | "closeDate" | "age" | "owner";
type SortDir = "asc" | "desc";

function dealAgeInDays(createdAt: Date): number {
  const diffMs = Date.now() - new Date(createdAt).getTime();
  return Math.floor(diffMs / 86_400_000);
}

function formatDealValue(deal: DealWithContact): string {
  return deal.value
    ? formatCurrency(parseFloat(deal.value), deal.currency)
    : "—";
}

function formatDealDate(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-caption uppercase tracking-wider text-[--ink-3]">{label}</dt>
      <dd className="mt-0.5 truncate text-body text-[--ink-1]">{value}</dd>
    </div>
  );
}

function ageBadgeClass(days: number): string {
  if (days <= 14) return "bg-[--surface-2] text-[--ink-2]";
  if (days <= 30) return "bg-[--warn-tint] text-[--warn]";
  return "bg-[--bad-tint] text-[--bad]";
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active)
    return (
      <svg className="inline ml-1 opacity-30" width="10" height="10" viewBox="0 0 10 10">
        <path d="M5 1 L8 4 H2Z" fill="currentColor" />
        <path d="M5 9 L2 6 H8Z" fill="currentColor" />
      </svg>
    );
  return dir === "asc" ? (
    <svg className="inline ml-1" width="10" height="10" viewBox="0 0 10 10">
      <path d="M5 1 L9 7 H1Z" fill="currentColor" />
    </svg>
  ) : (
    <svg className="inline ml-1" width="10" height="10" viewBox="0 0 10 10">
      <path d="M5 9 L1 3 H9Z" fill="currentColor" />
    </svg>
  );
}

export default function DealsTable({
  deals,
  owners,
}: {
  deals: DealWithContact[];
  owners: string[];
}) {
  const [sortKey, setSortKey] = useState<SortKey>("age");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Mobile-only: which deal's full detail is open in the bottom sheet.
  const [detailDeal, setDetailDeal] = useState<DealWithContact | null>(null);
  const [stageSelect, setStageSelect] = useState("lead");
  const [ownerInput, setOwnerInput] = useState("");
  const [feedback, setFeedback] = useState<{ msg: string; ok: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();

  const allIds = deals.map((d) => d.id);
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

  function handleMoveStage() {
    startTransition(async () => {
      const result = await bulkMoveStage(Array.from(selectedIds), stageSelect);
      if (result.error) flash(result.error, false);
      else flash(`Moved ${result.count} deal(s) to ${STAGE_LABELS[stageSelect]}.`);
      setSelectedIds(new Set());
      setSheetOpen(false);
      setSelectMode(false);
    });
  }

  function handleChangeOwner() {
    startTransition(async () => {
      const result = await bulkChangeOwner(Array.from(selectedIds), ownerInput);
      if (result.error) flash(result.error, false);
      else flash(`Updated owner for ${result.count} deal(s).`);
      setOwnerInput("");
      setSelectedIds(new Set());
      setSheetOpen(false);
      setSelectMode(false);
    });
  }

  function handleDelete() {
    if (!window.confirm(`Delete ${selectedIds.size} deal(s)? This cannot be undone.`)) return;
    startTransition(async () => {
      const result = await bulkDeleteDeals(Array.from(selectedIds));
      if (result.error) flash(result.error, false);
      else flash(`Deleted ${result.count} deal(s).`);
      setSelectedIds(new Set());
      setSheetOpen(false);
      setSelectMode(false);
    });
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sorted = [...deals].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case "title":
        cmp = a.title.localeCompare(b.title);
        break;
      case "contact":
        cmp = (a.contact?.name ?? "").localeCompare(b.contact?.name ?? "");
        break;
      case "stage":
        cmp = a.stage.localeCompare(b.stage);
        break;
      case "value":
        cmp = parseFloat(a.value ?? "0") - parseFloat(b.value ?? "0");
        break;
      case "closeDate": {
        const aDate = a.expectedCloseDate ? new Date(a.expectedCloseDate).getTime() : 0;
        const bDate = b.expectedCloseDate ? new Date(b.expectedCloseDate).getTime() : 0;
        cmp = aDate - bDate;
        break;
      }
      case "age":
        cmp = dealAgeInDays(a.createdAt) - dealAgeInDays(b.createdAt);
        break;
      case "owner":
        cmp = (a.owner ?? "").localeCompare(b.owner ?? "");
        break;
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  const thClass =
    "px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-[--ink-3] cursor-pointer select-none hover:text-[--ink-1] whitespace-nowrap";

  if (deals.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-[--ink-3]">No deals yet.</p>
    );
  }

  return (
    <div className="space-y-3">
      {/* Bulk action bar — desktop only (mobile uses the action sheet) */}
      {someSelected && (
        <div className="sticky top-0 z-30 hidden flex-wrap items-center gap-2 rounded-lg border border-[--accent]/30 bg-[--accent-tint] px-4 py-2 shadow-sm shadow-black/20 backdrop-blur lg:flex">
          <span className="flex min-h-[44px] items-center text-sm font-medium text-[--accent]">
            {selectedIds.size} selected
          </span>

          {/* Move to stage */}
          <div className="flex items-center gap-1.5">
            <select
              value={stageSelect}
              onChange={(e) => setStageSelect(e.target.value)}
              className="tap rounded border border-[--line-1] bg-[--surface-1] px-2 text-xs text-[--ink-1]"
            >
              {STAGES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
            <button
              onClick={handleMoveStage}
              disabled={isPending}
              className="tap flex items-center justify-center rounded bg-[--surface-2] px-2.5 text-xs font-medium text-[--ink-1] hover:bg-[--surface-3] disabled:opacity-50"
            >
              Move to stage
            </button>
          </div>

          {/* Set owner */}
          <div className="flex items-center gap-1.5">
            <input
              list="deal-owners-list"
              value={ownerInput}
              onChange={(e) => setOwnerInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleChangeOwner()}
              placeholder="Owner name"
              className="tap w-full rounded border border-[--line-1] bg-[--surface-1] px-2 text-xs text-[--ink-1] placeholder-[--ink-3] focus:outline-none focus:ring-1 focus:ring-[--accent] sm:w-32"
            />
            {owners.length > 0 && (
              <datalist id="deal-owners-list">
                {owners.map((o) => (
                  <option key={o} value={o} />
                ))}
              </datalist>
            )}
            <button
              onClick={handleChangeOwner}
              disabled={isPending}
              className="tap flex items-center justify-center rounded bg-[--surface-2] px-2.5 text-xs font-medium text-[--ink-1] hover:bg-[--surface-3] disabled:opacity-50"
            >
              Set owner
            </button>
          </div>

          {/* Delete */}
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="tap flex items-center justify-center rounded bg-[--bad-tint] px-2.5 text-xs font-medium text-[--bad] hover:opacity-80 disabled:opacity-50"
          >
            Delete
          </button>

          <div className="ml-auto flex items-center gap-3">
            {feedback && (
              <span className={`text-xs ${feedback.ok ? "text-[--ok]" : "text-[--bad]"}`}>
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

      {/* Mobile stacked cards */}
      <div className="overflow-hidden rounded-xl border border-[--line-1] lg:hidden">
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
                  aria-label="Select all deals"
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
              feedback.ok ? "text-[--ok]" : "text-[--bad]"
            }`}
          >
            {feedback.msg}
          </div>
        )}

        <div className="divide-y divide-[--line-1]">
          {sorted.map((deal) => {
            const age = dealAgeInDays(deal.createdAt);
            const isSelected = selectedIds.has(deal.id);
            const value = formatDealValue(deal);

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
                  <p className="truncate text-body font-medium text-[--ink-1]">{deal.title}</p>
                  <p className="truncate text-xs text-[--ink-2]">
                    {deal.contact?.name && (
                      <span className="text-[--ink-1]">{deal.contact.name} • </span>
                    )}
                    <span className={`font-medium ${STAGE_COLORS[deal.stage] ?? "text-[--ink-2]"}`}>
                      {STAGE_LABELS[deal.stage] ?? deal.stage}
                    </span>
                    <span> • {value}</span>
                  </p>
                </div>
                <span
                  className={`inline-flex flex-shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${ageBadgeClass(age)}`}
                >
                  {age}d
                </span>
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
                  key={deal.id}
                  type="button"
                  onClick={() => toggle(deal.id)}
                  aria-pressed={isSelected}
                  aria-label={`Select ${deal.title}`}
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
              <button
                key={deal.id}
                type="button"
                onClick={() => setDetailDeal(deal)}
                aria-label={`View ${deal.title} details`}
                className="flex min-h-[44px] w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[--surface-2]/40 active:bg-[--surface-2]/60"
              >
                {body}
              </button>
            );
          })}
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden max-w-full overflow-x-auto overscroll-x-contain rounded-xl border border-[--line-1] lg:block">
        <table className="w-full text-sm">
          <thead className="border-b border-[--line-1] bg-[--surface-1]">
            <tr>
              <th className="sticky left-0 z-20 w-11 bg-[--surface-1]">
                <label className="flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected && !allSelected;
                    }}
                    onChange={toggleAll}
                    aria-label="Select all deals"
                    className="h-4 w-4 cursor-pointer rounded border-[--line-2] accent-[--accent]"
                  />
                </label>
              </th>
              <th className={`${thClass} sticky left-11 z-20 bg-[--surface-1] border-r border-[--line-1]`} onClick={() => handleSort("title")}>
                Title <SortIcon active={sortKey === "title"} dir={sortDir} />
              </th>
              <th className={thClass} onClick={() => handleSort("contact")}>
                Contact <SortIcon active={sortKey === "contact"} dir={sortDir} />
              </th>
              <th className={thClass} onClick={() => handleSort("stage")}>
                Stage <SortIcon active={sortKey === "stage"} dir={sortDir} />
              </th>
              <th className={thClass} onClick={() => handleSort("value")}>
                Value <SortIcon active={sortKey === "value"} dir={sortDir} />
              </th>
              <th className={thClass} onClick={() => handleSort("closeDate")}>
                Close Date <SortIcon active={sortKey === "closeDate"} dir={sortDir} />
              </th>
              <th className={thClass} onClick={() => handleSort("owner")}>
                Owner <SortIcon active={sortKey === "owner"} dir={sortDir} />
              </th>
              <th className={thClass} onClick={() => handleSort("age")}>
                Days open <SortIcon active={sortKey === "age"} dir={sortDir} />
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((deal, i) => {
              const age = dealAgeInDays(deal.createdAt);
              const isSelected = selectedIds.has(deal.id);
              const value = deal.value
                ? formatCurrency(parseFloat(deal.value), deal.currency)
                : "—";
              const closeDate = deal.expectedCloseDate
                ? new Date(deal.expectedCloseDate).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "—";

              return (
                <tr
                  key={deal.id}
                  className={`border-b border-[--line-1] last:border-0 transition-colors ${
                    isSelected
                      ? "bg-[--accent-tint]"
                      : i % 2 === 0
                        ? "bg-[--surface-1] hover:bg-[--surface-2]/40"
                        : "bg-[--surface-1]/60 hover:bg-[--surface-2]/40"
                  }`}
                >
                  <td className={`sticky left-0 z-10 w-11 ${isSelected ? "bg-[--accent-tint]" : "bg-[--surface-1]"}`}>
                    <label className="flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggle(deal.id)}
                        aria-label={`Select ${deal.title}`}
                        className="h-4 w-4 cursor-pointer rounded border-[--line-2] accent-[--accent]"
                      />
                    </label>
                  </td>
                  <td className={`px-4 py-3 font-medium text-[--ink-1] sticky left-11 z-10 border-r border-[--line-1] ${isSelected ? "bg-[--accent-tint]" : "bg-[--surface-1]"}`}>
                    <Link href={`/deals/${deal.id}`} className="hover:underline">
                      {deal.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[--ink-2]">
                    {deal.contact ? (
                      <Link
                        href={`/contacts/${deal.contact.id}`}
                        className="hover:underline"
                      >
                        {deal.contact.name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-medium ${STAGE_COLORS[deal.stage] ?? "text-[--ink-2]"}`}>
                      {STAGE_LABELS[deal.stage] ?? deal.stage}
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-[--ink-2]">{value}</td>
                  <td className="px-4 py-3 tabular-nums text-[--ink-2]">{closeDate}</td>
                  <td className="px-4 py-3 text-[--ink-2]">{deal.owner ?? "—"}</td>
                  <td className="px-4 py-3 tabular-nums">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ageBadgeClass(age)}`}>
                      {age}d
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile bulk-action sheet — mirrors the desktop bulk bar */}
      <MobileActionSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={`${selectedIds.size} selected`}
      >
        <div className="flex flex-col gap-3">
          {/* Move to stage */}
          <div className="flex items-center gap-2">
            <select
              aria-label="Set stage for selected deals"
              value={stageSelect}
              onChange={(e) => setStageSelect(e.target.value)}
              className="min-h-[44px] min-w-0 flex-1 rounded-lg border border-[--line-1] bg-[--surface-1] px-3 text-sm text-[--ink-1]"
            >
              {STAGES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
            <button
              onClick={handleMoveStage}
              disabled={isPending}
              className="tap flex shrink-0 items-center justify-center rounded-lg bg-[--surface-2] px-4 text-sm font-medium text-[--ink-1] hover:bg-[--surface-3] disabled:opacity-50"
            >
              Move to stage
            </button>
          </div>

          {/* Set owner */}
          <div className="flex items-center gap-2">
            <input
              list="deal-owners-list-sheet"
              aria-label="New owner name"
              value={ownerInput}
              onChange={(e) => setOwnerInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleChangeOwner()}
              placeholder="Owner name"
              className="min-h-[44px] min-w-0 flex-1 rounded-lg border border-[--line-1] bg-[--surface-1] px-3 text-sm text-[--ink-1] placeholder-[--ink-3] focus:outline-none focus:ring-1 focus:ring-[--accent]"
            />
            {owners.length > 0 && (
              <datalist id="deal-owners-list-sheet">
                {owners.map((o) => (
                  <option key={o} value={o} />
                ))}
              </datalist>
            )}
            <button
              onClick={handleChangeOwner}
              disabled={isPending}
              className="tap flex shrink-0 items-center justify-center rounded-lg bg-[--surface-2] px-4 text-sm font-medium text-[--ink-1] hover:bg-[--surface-3] disabled:opacity-50"
            >
              Set owner
            </button>
          </div>

          {/* Delete */}
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="tap flex items-center justify-center rounded-lg bg-[--bad-tint] px-4 text-sm font-medium text-[--bad] hover:opacity-80 disabled:opacity-50"
          >
            Delete {selectedIds.size} deal(s)
          </button>
        </div>
      </MobileActionSheet>

      {/* Mobile deal-detail sheet — full record, tap a card to open */}
      <MobileActionSheet
        open={detailDeal !== null}
        onClose={() => setDetailDeal(null)}
        title="Deal"
      >
        {detailDeal && (
          <div className="space-y-4">
            <div>
              <h3 className="text-title3 font-semibold text-[--ink-1]">
                {detailDeal.title}
              </h3>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full bg-[--surface-1] px-2.5 py-0.5 text-xs font-medium ${
                    STAGE_COLORS[detailDeal.stage] ?? "text-[--ink-2]"
                  }`}
                >
                  {STAGE_LABELS[detailDeal.stage] ?? detailDeal.stage}
                </span>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${ageBadgeClass(
                    dealAgeInDays(detailDeal.createdAt),
                  )}`}
                >
                  {dealAgeInDays(detailDeal.createdAt)}d open
                </span>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              <DetailField label="Value" value={formatDealValue(detailDeal)} />
              <DetailField label="Probability" value={`${detailDeal.probability}%`} />
              <DetailField label="Contact" value={detailDeal.contact?.name ?? "—"} />
              <DetailField label="Owner" value={detailDeal.owner ?? "—"} />
              <DetailField
                label="Expected close"
                value={formatDealDate(detailDeal.expectedCloseDate)}
              />
              <DetailField label="Created" value={formatDealDate(detailDeal.createdAt)} />
            </dl>

            {detailDeal.notes && (
              <div>
                <dt className="text-caption uppercase tracking-wider text-[--ink-3]">
                  Notes
                </dt>
                <dd className="mt-1 whitespace-pre-wrap text-body text-[--ink-2]">
                  {detailDeal.notes}
                </dd>
              </div>
            )}

            <Link
              href={`/deals/${detailDeal.id}`}
              className="tap flex min-h-[44px] items-center justify-center rounded-lg bg-[--accent] px-4 text-sm font-medium text-[--accent-ink] transition-colors hover:bg-[--accent-hover]"
            >
              Open full deal
            </Link>
          </div>
        )}
      </MobileActionSheet>
    </div>
  );
}
