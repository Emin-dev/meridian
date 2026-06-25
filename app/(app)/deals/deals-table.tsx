"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Deal, Contact } from "@/db/schema";
import { bulkMoveStage, bulkChangeOwner, bulkDeleteDeals } from "./actions";

type DealWithContact = Deal & { contact: Contact | null };

const STAGE_LABELS: Record<string, string> = {
  lead: "Lead",
  qualified: "Qualified",
  proposal: "Proposal",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
};

const STAGE_COLORS: Record<string, string> = {
  lead: "text-blue-400",
  qualified: "text-violet-400",
  proposal: "text-yellow-400",
  negotiation: "text-orange-400",
  won: "text-green-400",
  lost: "text-red-400",
};

const STAGE_OPTIONS = [
  { value: "lead", label: "Lead" },
  { value: "qualified", label: "Qualified" },
  { value: "proposal", label: "Proposal" },
  { value: "negotiation", label: "Negotiation" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
] as const;

type SortKey = "title" | "contact" | "stage" | "value" | "closeDate" | "age" | "owner";
type SortDir = "asc" | "desc";

function dealAgeInDays(createdAt: Date): number {
  const diffMs = Date.now() - new Date(createdAt).getTime();
  return Math.floor(diffMs / 86_400_000);
}

function ageBadgeClass(days: number): string {
  if (days <= 14) return "bg-neutral-500/15 text-neutral-400";
  if (days <= 30) return "bg-amber-500/15 text-amber-400";
  return "bg-red-500/15 text-red-400";
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
    });
  }

  function handleChangeOwner() {
    startTransition(async () => {
      const result = await bulkChangeOwner(Array.from(selectedIds), ownerInput);
      if (result.error) flash(result.error, false);
      else flash(`Updated owner for ${result.count} deal(s).`);
      setOwnerInput("");
      setSelectedIds(new Set());
    });
  }

  function handleDelete() {
    if (!window.confirm(`Delete ${selectedIds.size} deal(s)? This cannot be undone.`)) return;
    startTransition(async () => {
      const result = await bulkDeleteDeals(Array.from(selectedIds));
      if (result.error) flash(result.error, false);
      else flash(`Deleted ${result.count} deal(s).`);
      setSelectedIds(new Set());
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
    "px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-neutral-400 cursor-pointer select-none hover:text-neutral-200 whitespace-nowrap";

  if (deals.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-neutral-500">No deals yet.</p>
    );
  }

  return (
    <div className="space-y-3">
      {/* Bulk action bar */}
      {someSelected && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-4 py-2">
          <span className="flex min-h-[44px] items-center text-sm font-medium text-indigo-300">
            {selectedIds.size} selected
          </span>

          {/* Move to stage */}
          <div className="flex items-center gap-1.5">
            <select
              value={stageSelect}
              onChange={(e) => setStageSelect(e.target.value)}
              className="tap rounded border border-neutral-700 bg-neutral-900 px-2 text-xs text-neutral-200"
            >
              {STAGE_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <button
              onClick={handleMoveStage}
              disabled={isPending}
              className="tap flex items-center justify-center rounded bg-neutral-700 px-2.5 text-xs font-medium text-neutral-200 hover:bg-neutral-600 disabled:opacity-50"
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
              className="tap w-full rounded border border-neutral-700 bg-neutral-900 px-2 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:w-32"
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
              className="tap flex items-center justify-center rounded bg-neutral-700 px-2.5 text-xs font-medium text-neutral-200 hover:bg-neutral-600 disabled:opacity-50"
            >
              Set owner
            </button>
          </div>

          {/* Delete */}
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="tap flex items-center justify-center rounded bg-red-500/15 px-2.5 text-xs font-medium text-red-400 hover:bg-red-500/25 disabled:opacity-50"
          >
            Delete
          </button>

          <div className="ml-auto flex items-center gap-3">
            {feedback && (
              <span className={`text-xs ${feedback.ok ? "text-emerald-400" : "text-red-400"}`}>
                {feedback.msg}
              </span>
            )}
            <button
              onClick={() => setSelectedIds(new Set())}
              className="tap flex items-center justify-center text-xs text-neutral-500 hover:text-neutral-300"
            >
              Clear selection
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-neutral-800">
        <table className="w-full text-sm">
          <thead className="border-b border-neutral-800 bg-neutral-900">
            <tr>
              <th className="w-10 px-3 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected && !allSelected;
                  }}
                  onChange={toggleAll}
                  aria-label="Select all deals"
                  className="h-4 w-4 cursor-pointer rounded border-neutral-600 accent-indigo-500"
                />
              </th>
              <th className={thClass} onClick={() => handleSort("title")}>
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
                ? new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: deal.currency,
                    maximumFractionDigits: 0,
                  }).format(parseFloat(deal.value))
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
                  className={`border-b border-neutral-800 last:border-0 transition-colors ${
                    isSelected
                      ? "bg-indigo-500/5"
                      : i % 2 === 0
                        ? "bg-neutral-900 hover:bg-neutral-800/50"
                        : "bg-neutral-900/60 hover:bg-neutral-800/50"
                  }`}
                >
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggle(deal.id)}
                      aria-label={`Select ${deal.title}`}
                      className="h-4 w-4 cursor-pointer rounded border-neutral-600 accent-indigo-500"
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-neutral-100">
                    <Link href={`/deals/${deal.id}`} className="hover:underline">
                      {deal.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-neutral-300">
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
                    <span className={`font-medium ${STAGE_COLORS[deal.stage] ?? "text-neutral-400"}`}>
                      {STAGE_LABELS[deal.stage] ?? deal.stage}
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-neutral-300">{value}</td>
                  <td className="px-4 py-3 tabular-nums text-neutral-300">{closeDate}</td>
                  <td className="px-4 py-3 text-neutral-400">{deal.owner ?? "—"}</td>
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
    </div>
  );
}
