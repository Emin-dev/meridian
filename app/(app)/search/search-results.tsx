"use client";

import { useState } from "react";
import Link from "next/link";
import MobileActionSheet from "@/components/mobile-action-sheet";
import type { SearchResults, SearchPages } from "./actions";

type Tab = "contacts" | "deals" | "activities";
const VALID_TABS: Tab[] = ["contacts", "deals", "activities"];

type ContactResult = SearchResults["contacts"][number];
type DealResult = SearchResults["deals"][number];
type ActivityResult = SearchResults["activities"][number];

// The single item expanded in the mobile bottom sheet, tagged by kind so the
// sheet can render the right read-only detail without a separate piece of state
// per tab.
type Selected =
  | { kind: "contact"; item: ContactResult }
  | { kind: "deal"; item: DealResult }
  | { kind: "activity"; item: ActivityResult };

// Maps each tab to its dedicated page URL-param, so "Load more" can grow one
// tab's window without disturbing the others.
const PAGE_PARAM: Record<Tab, "cp" | "dp" | "ap"> = {
  contacts: "cp",
  deals: "dp",
  activities: "ap",
};

function formatDealValue(value: string | null): string | null {
  if (!value) return null;
  return `$${Number(value).toLocaleString()}`;
}

export default function SearchResultsTabs({
  results,
  query,
  initialTab: initialTabProp,
  pages,
}: {
  results: SearchResults;
  query: string;
  initialTab?: string;
  pages: SearchPages;
}) {
  const counts = {
    contacts: results.contacts.length,
    deals: results.deals.length,
    activities: results.activities.length,
  };

  // Build the "Load more" href for a tab: keep the query, pin the active tab so
  // the page doesn't reset to the default tab after navigation, preserve the
  // other tabs' already-loaded windows, and bump this tab's page by one.
  function loadMoreHref(tabKey: Tab): string {
    const params = new URLSearchParams();
    params.set("q", query);
    params.set("tab", tabKey);
    params.set("cp", String(pages.contacts));
    params.set("dp", String(pages.deals));
    params.set("ap", String(pages.activities));
    params.set(PAGE_PARAM[tabKey], String(pages[tabKey] + 1));
    return `/search?${params.toString()}`;
  }

  const parsedInitial = VALID_TABS.includes(initialTabProp as Tab)
    ? (initialTabProp as Tab)
    : undefined;

  const defaultTab: Tab =
    parsedInitial ??
    (results.contacts.length > 0
      ? "contacts"
      : results.deals.length > 0
        ? "deals"
        : results.activities.length > 0
          ? "activities"
          : "contacts");

  const [tab, setTab] = useState<Tab>(defaultTab);
  const [selected, setSelected] = useState<Selected | null>(null);

  const tabs: { key: Tab; label: string }[] = [
    { key: "contacts", label: "Contacts" },
    { key: "deals", label: "Deals" },
    { key: "activities", label: "Activities" },
  ];

  return (
    <>
      <div className="card overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b border-[var(--line-1)]">
          {tabs.map((t) => {
            const active = t.key === tab;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={[
                  "tap flex items-center gap-2 px-4 text-body font-medium transition-colors",
                  active
                    ? "border-b-2 border-[var(--accent)] text-[var(--ink-1)]"
                    : "border-b-2 border-transparent text-[var(--ink-2)] hover:text-[var(--ink-1)]",
                ].join(" ")}
              >
                {t.label}
                <span
                  className={[
                    "rounded-full px-2 py-0.5 text-caption",
                    active
                      ? "bg-[var(--accent-tint)] text-[var(--accent)]"
                      : "bg-[var(--surface-2)] text-[var(--ink-3)]",
                  ].join(" ")}
                >
                  {results.hasMore[t.key]
                    ? `${counts[t.key]}+`
                    : counts[t.key]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Desktop (≥lg): the original dense, link-per-row list. */}
        <div className="hidden divide-y divide-[var(--line-1)] lg:block">
          {tab === "contacts" &&
            (results.contacts.length === 0 ? (
              <EmptyTab label="contacts" query={query} />
            ) : (
              results.contacts.map((c) => (
                <Link
                  key={c.id}
                  href={`/contacts/${c.id}`}
                  className="tap flex items-center gap-3 px-4 transition-colors hover:bg-[var(--surface-2)]"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-body font-medium text-[var(--ink-1)]">
                    {c.name[0]?.toUpperCase() ?? "?"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body font-medium text-[var(--ink-1)]">
                      {c.name}
                    </span>
                    {(c.company || c.email) && (
                      <span className="block truncate text-footnote text-[var(--ink-3)]">
                        {c.company || c.email}
                      </span>
                    )}
                  </span>
                </Link>
              ))
            ))}

          {tab === "deals" &&
            (results.deals.length === 0 ? (
              <EmptyTab label="deals" query={query} />
            ) : (
              results.deals.map((d) => (
                <Link
                  key={d.id}
                  href={`/deals/${d.id}`}
                  className="tap flex items-center gap-3 px-4 transition-colors hover:bg-[var(--surface-2)]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body font-medium text-[var(--ink-1)]">
                      {d.title}
                    </span>
                    <span className="block truncate text-footnote capitalize text-[var(--ink-3)]">
                      {d.stage}
                    </span>
                  </span>
                  {d.value && (
                    <span className="shrink-0 text-body text-[var(--ink-2)]">
                      {formatDealValue(d.value)}
                    </span>
                  )}
                </Link>
              ))
            ))}

          {tab === "activities" &&
            (results.activities.length === 0 ? (
              <EmptyTab label="activities" query={query} />
            ) : (
              results.activities.map((a) => (
                <Link
                  key={a.id}
                  href="/activity"
                  className="tap flex items-center gap-3 px-4 transition-colors hover:bg-[var(--surface-2)]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body font-medium text-[var(--ink-1)]">
                      {a.subject}
                    </span>
                    {a.body && (
                      <span className="block truncate text-footnote text-[var(--ink-3)]">
                        {a.body}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 rounded-[var(--r-sm)] px-1.5 py-0.5 text-caption font-medium capitalize bg-[var(--surface-2)] text-[var(--ink-2)]">
                    {a.type}
                  </span>
                </Link>
              ))
            ))}
        </div>

        {/* Mobile (<lg): glanceable cards that open a read-only detail sheet on
            tap, per the iOS-Weather tap-first pattern (MOBILE.md). */}
        <div className="space-y-2.5 p-3 lg:hidden">
          {tab === "contacts" &&
            (results.contacts.length === 0 ? (
              <EmptyTab label="contacts" query={query} />
            ) : (
              results.contacts.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelected({ kind: "contact", item: c })}
                  className="tap press flex w-full items-center gap-3 rounded-[var(--r-lg)] border border-[var(--line-1)] bg-[var(--surface-1)] p-4 text-left"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-body font-medium text-[var(--ink-1)]">
                    {c.name[0]?.toUpperCase() ?? "?"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body font-medium text-[var(--ink-1)]">
                      {c.name}
                    </span>
                    {(c.company || c.email) && (
                      <span className="block truncate text-footnote text-[var(--ink-3)]">
                        {c.company || c.email}
                      </span>
                    )}
                  </span>
                </button>
              ))
            ))}

          {tab === "deals" &&
            (results.deals.length === 0 ? (
              <EmptyTab label="deals" query={query} />
            ) : (
              results.deals.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setSelected({ kind: "deal", item: d })}
                  className="tap press flex w-full items-center gap-3 rounded-[var(--r-lg)] border border-[var(--line-1)] bg-[var(--surface-1)] p-4 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body font-medium text-[var(--ink-1)]">
                      {d.title}
                    </span>
                    <span className="block truncate text-footnote capitalize text-[var(--ink-3)]">
                      {d.stage}
                    </span>
                  </span>
                  {d.value && (
                    <span className="shrink-0 text-body font-medium text-[var(--ink-2)]">
                      {formatDealValue(d.value)}
                    </span>
                  )}
                </button>
              ))
            ))}

          {tab === "activities" &&
            (results.activities.length === 0 ? (
              <EmptyTab label="activities" query={query} />
            ) : (
              results.activities.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSelected({ kind: "activity", item: a })}
                  className="tap press flex w-full items-center gap-3 rounded-[var(--r-lg)] border border-[var(--line-1)] bg-[var(--surface-1)] p-4 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body font-medium text-[var(--ink-1)]">
                      {a.subject}
                    </span>
                    {a.body && (
                      <span className="block truncate text-footnote text-[var(--ink-3)]">
                        {a.body}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 rounded-[var(--r-sm)] px-1.5 py-0.5 text-caption font-medium capitalize bg-[var(--surface-2)] text-[var(--ink-2)]">
                    {a.type}
                  </span>
                </button>
              ))
            ))}
        </div>

        {/* Load more — bounded per-tab pagination; only shown when the active tab
            has further matches beyond the rows already loaded. */}
        {results.hasMore[tab] && (
          <div className="flex justify-center border-t border-[var(--line-1)] p-3">
            <Link
              href={loadMoreHref(tab)}
              scroll={false}
              className="tap flex items-center justify-center rounded-[var(--r-lg)] border border-[var(--line-1)] bg-[var(--surface-1)] px-5 text-body font-medium text-[var(--ink-1)] transition-colors hover:bg-[var(--surface-2)]"
            >
              Load more
            </Link>
          </div>
        )}
      </div>

      {/* Tap-to-expand detail sheet (mobile). Read-only — mirrors the row data
          and links through to the full record. */}
      <MobileActionSheet
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={
          selected?.kind === "deal"
            ? "Deal"
            : selected?.kind === "activity"
              ? "Activity"
              : "Contact"
        }
      >
        {selected?.kind === "contact" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--surface-1)] text-title3 font-medium text-[var(--ink-1)]">
                {selected.item.name[0]?.toUpperCase() ?? "?"}
              </span>
              <h3 className="min-w-0 flex-1 break-words text-callout font-semibold text-[var(--ink-1)]">
                {selected.item.name}
              </h3>
            </div>
            <dl className="space-y-2">
              <DetailRow label="Company" value={selected.item.company} />
              <DetailRow label="Email" value={selected.item.email} />
            </dl>
            <ViewFullLink href={`/contacts/${selected.item.id}`} label="View full contact" />
          </div>
        )}

        {selected?.kind === "deal" && (
          <div className="space-y-4">
            <h3 className="break-words text-callout font-semibold text-[var(--ink-1)]">
              {selected.item.title}
            </h3>
            <dl className="space-y-2">
              <DetailRow
                label="Stage"
                value={selected.item.stage}
                valueClassName="capitalize"
              />
              <DetailRow label="Value" value={formatDealValue(selected.item.value)} />
            </dl>
            <ViewFullLink href={`/deals/${selected.item.id}`} label="View full deal" />
          </div>
        )}

        {selected?.kind === "activity" && (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <h3 className="min-w-0 flex-1 break-words text-callout font-semibold text-[var(--ink-1)]">
                {selected.item.subject}
              </h3>
              <span className="shrink-0 rounded-[var(--r-sm)] px-1.5 py-0.5 text-caption font-medium capitalize bg-[var(--surface-1)] text-[var(--ink-2)]">
                {selected.item.type}
              </span>
            </div>
            {selected.item.body && (
              <p className="break-words text-footnote text-[var(--ink-2)]">
                {selected.item.body}
              </p>
            )}
            <ViewFullLink href="/activity" label="View in activity" />
          </div>
        )}
      </MobileActionSheet>
    </>
  );
}

function DetailRow({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string | null;
  valueClassName?: string;
}) {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-footnote text-[var(--ink-3)]">{label}</dt>
      <dd
        className={[
          "min-w-0 break-words text-right text-body text-[var(--ink-1)]",
          valueClassName ?? "",
        ].join(" ")}
      >
        {value}
      </dd>
    </div>
  );
}

function ViewFullLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="tap inline-flex items-center text-footnote text-[var(--ink-2)] transition-colors hover:text-[var(--ink-1)]"
    >
      {label} →
    </Link>
  );
}

function EmptyTab({ label, query }: { label: string; query: string }) {
  return (
    <p className="px-4 py-12 text-center text-body text-[var(--ink-3)]">
      No {label} match &ldquo;{query}&rdquo;.
    </p>
  );
}
