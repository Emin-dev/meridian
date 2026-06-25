"use client";

import { useState } from "react";
import Link from "next/link";
import type { Deal, Contact } from "@/db/schema";

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

type SortKey = "title" | "contact" | "stage" | "value" | "closeDate" | "age";
type SortDir = "asc" | "desc";

function stageAgeInDays(updatedAt: Date): number {
  const diffMs = Date.now() - new Date(updatedAt).getTime();
  return Math.floor(diffMs / 86_400_000);
}

function ageBadgeClass(days: number): string {
  if (days < 7) return "bg-green-500/15 text-green-400";
  if (days <= 14) return "bg-amber-500/15 text-amber-400";
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

export default function DealsTable({ deals }: { deals: DealWithContact[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("age");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

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
        cmp = stageAgeInDays(a.updatedAt) - stageAgeInDays(b.updatedAt);
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
    <div className="overflow-x-auto rounded-xl border border-neutral-800">
      <table className="w-full text-sm">
        <thead className="border-b border-neutral-800 bg-neutral-900">
          <tr>
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
            <th className={thClass} onClick={() => handleSort("age")}>
              In Stage <SortIcon active={sortKey === "age"} dir={sortDir} />
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((deal, i) => {
            const age = stageAgeInDays(deal.updatedAt);
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
                className={`border-b border-neutral-800 last:border-0 transition-colors hover:bg-neutral-800/50 ${
                  i % 2 === 0 ? "bg-neutral-900" : "bg-neutral-900/60"
                }`}
              >
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
  );
}
