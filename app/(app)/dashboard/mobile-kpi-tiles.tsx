"use client";

import { useState } from "react";
import Link from "next/link";

import MobileActionSheet from "@/components/mobile-action-sheet";
import { formatCurrency } from "@/lib/format";

type ContactItem = { name: string; company: string | null };
type DealItem = { title: string; stage: string; value: number };
type StageBreakdown = {
  stage: string;
  count: number;
  value: number;
  weighted: number;
};
type ActivityItem = {
  subject: string;
  type: string;
  contactName: string | null;
  date: string;
};

type TileKey =
  | "contacts"
  | "openDeals"
  | "pipeline"
  | "weighted"
  | "activities";

const STAGE_LABEL: Record<string, string> = {
  lead: "Lead",
  qualified: "Qualified",
  proposal: "Proposal",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
};

function EmptyRow({ children }: { children: string }) {
  return (
    <p className="px-1 py-6 text-center text-sm text-[var(--ink-3)]">{children}</p>
  );
}

export default function MobileKpiTiles({
  totalContacts,
  openDealsCount,
  pipelineValue,
  weightedPipelineValue,
  weekActivityCount,
  currency,
  recentContacts,
  openDeals,
  stageBreakdown,
  recentActivities,
}: {
  totalContacts: number;
  openDealsCount: number;
  pipelineValue: number;
  weightedPipelineValue: number;
  weekActivityCount: number;
  currency: string;
  recentContacts: ContactItem[];
  openDeals: DealItem[];
  stageBreakdown: StageBreakdown[];
  recentActivities: ActivityItem[];
}) {
  const [active, setActive] = useState<TileKey | null>(null);

  const tiles: { key: TileKey; label: string; value: string }[] = [
    { key: "contacts", label: "Total Contacts", value: totalContacts.toString() },
    { key: "openDeals", label: "Open Deals", value: openDealsCount.toString() },
    { key: "pipeline", label: "Pipeline Value", value: formatCurrency(pipelineValue, currency) },
    {
      key: "weighted",
      label: "Weighted Pipeline",
      value: formatCurrency(weightedPipelineValue, currency),
    },
    {
      key: "activities",
      label: "Activities This Week",
      value: weekActivityCount.toString(),
    },
  ];

  const SHEET_TITLE: Record<TileKey, string> = {
    contacts: "Recent Contacts",
    openDeals: "Open Deals",
    pipeline: "Pipeline by Stage",
    weighted: "Weighted by Stage",
    activities: "Recent Activity",
  };

  function renderSheet(key: TileKey) {
    switch (key) {
      case "contacts":
        return (
          <>
            {recentContacts.length === 0 ? (
              <EmptyRow>No contacts yet.</EmptyRow>
            ) : (
              <ul className="divide-y divide-[var(--line-1)]">
                {recentContacts.map((c, i) => (
                  <li key={i} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--ink-1)]">
                        {c.name}
                      </p>
                      {c.company && (
                        <p className="truncate text-xs text-[var(--ink-3)]">
                          {c.company}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href="/contacts"
              onClick={() => setActive(null)}
              className="tap mt-2 flex items-center justify-center rounded-[var(--r-md)] bg-[var(--surface-3)] text-sm font-medium text-[var(--accent)]"
            >
              View all contacts
            </Link>
          </>
        );
      case "openDeals":
        return (
          <>
            {openDeals.length === 0 ? (
              <EmptyRow>No open deals.</EmptyRow>
            ) : (
              <ul className="divide-y divide-[var(--line-1)]">
                {openDeals.map((d, i) => (
                  <li key={i} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--ink-1)]">
                        {d.title}
                      </p>
                      <p className="text-xs text-[var(--ink-3)]">
                        {STAGE_LABEL[d.stage] ?? d.stage}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-[var(--ink-1)]">
                      {formatCurrency(d.value, currency)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href="/deals"
              onClick={() => setActive(null)}
              className="tap mt-2 flex items-center justify-center rounded-[var(--r-md)] bg-[var(--surface-3)] text-sm font-medium text-[var(--accent)]"
            >
              View all deals
            </Link>
          </>
        );
      case "pipeline":
      case "weighted": {
        const weighted = key === "weighted";
        const rows = stageBreakdown.filter((s) => s.count > 0);
        return rows.length === 0 ? (
          <EmptyRow>No open deals.</EmptyRow>
        ) : (
          <ul className="divide-y divide-[var(--line-1)]">
            {rows.map((s) => (
              <li key={s.stage} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--ink-1)]">
                    {STAGE_LABEL[s.stage] ?? s.stage}
                  </p>
                  <p className="text-xs text-[var(--ink-3)]">
                    {s.count} {s.count === 1 ? "deal" : "deals"}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold text-[var(--ink-1)]">
                  {formatCurrency(weighted ? s.weighted : s.value, currency)}
                </span>
              </li>
            ))}
          </ul>
        );
      }
      case "activities":
        return recentActivities.length === 0 ? (
          <EmptyRow>No activity recorded yet.</EmptyRow>
        ) : (
          <ul className="divide-y divide-[var(--line-1)]">
            {recentActivities.map((a, i) => (
              <li key={i} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--ink-1)]">
                    {a.subject}
                  </p>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-[var(--ink-3)]">
                    <span>{a.date}</span>
                    {a.contactName && (
                      <>
                        <span aria-hidden>·</span>
                        <span className="truncate">{a.contactName}</span>
                      </>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        );
    }
  }

  return (
    <>
      <div className="anim-stagger grid grid-cols-2 gap-3">
        {tiles.map((tile, index) => {
          const isOrphan =
            index === tiles.length - 1 && tiles.length % 2 === 1;
          return (
            <button
              key={tile.key}
              type="button"
              onClick={() => setActive(tile.key)}
              className={`card tap flex flex-col items-start p-3 text-left${
                isOrphan ? " col-span-2" : ""
              }`}
            >
              <span className="text-caption font-medium uppercase tracking-wide text-[var(--ink-3)]">
                {tile.label}
              </span>
              <span className="text-title3 mt-1 font-semibold text-[var(--ink-1)]">
                {tile.value}
              </span>
            </button>
          );
        })}
      </div>

      <MobileActionSheet
        open={active !== null}
        onClose={() => setActive(null)}
        title={active ? SHEET_TITLE[active] : undefined}
      >
        <div className="max-h-[70svh] overflow-y-auto">
          {active && renderSheet(active)}
        </div>
      </MobileActionSheet>
    </>
  );
}
