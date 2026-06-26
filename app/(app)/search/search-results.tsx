"use client";

import { useState } from "react";
import Link from "next/link";
import { SEARCH_RESULT_LIMIT, type SearchResults } from "./actions";

type Tab = "contacts" | "deals" | "activities";
const VALID_TABS: Tab[] = ["contacts", "deals", "activities"];

export default function SearchResultsTabs({
  results,
  query,
  initialTab: initialTabProp,
}: {
  results: SearchResults;
  query: string;
  initialTab?: string;
}) {
  const counts = {
    contacts: results.totals.contacts,
    deals: results.totals.deals,
    activities: results.totals.activities,
  };

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

  const tabs: { key: Tab; label: string }[] = [
    { key: "contacts", label: "Contacts" },
    { key: "deals", label: "Deals" },
    { key: "activities", label: "Activities" },
  ];

  return (
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
                {counts[t.key] >= SEARCH_RESULT_LIMIT
                  ? `${SEARCH_RESULT_LIMIT}+`
                  : counts[t.key]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="divide-y divide-[var(--line-1)]">
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
                    ${Number(d.value).toLocaleString()}
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
    </div>
  );
}

function EmptyTab({ label, query }: { label: string; query: string }) {
  return (
    <p className="px-4 py-12 text-center text-body text-[var(--ink-3)]">
      No {label} match &ldquo;{query}&rdquo;.
    </p>
  );
}
