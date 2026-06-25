"use client";

import { useState } from "react";
import Link from "next/link";
import type { SearchResults } from "./actions";

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

  // Use URL-provided tab if valid, otherwise default to the first tab with results.
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
    <div className="rounded-xl border border-neutral-800 bg-neutral-900">
      {/* Tab bar */}
      <div className="flex border-b border-neutral-800">
        {tabs.map((t) => {
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={[
                "flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors",
                active
                  ? "border-b-2 border-indigo-500 text-neutral-100"
                  : "border-b-2 border-transparent text-neutral-400 hover:text-neutral-200",
              ].join(" ")}
            >
              {t.label}
              <span
                className={[
                  "rounded-full px-2 py-0.5 text-xs",
                  active
                    ? "bg-indigo-500/20 text-indigo-300"
                    : "bg-neutral-800 text-neutral-500",
                ].join(" ")}
              >
                {counts[t.key]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="divide-y divide-neutral-800">
        {tab === "contacts" &&
          (results.contacts.length === 0 ? (
            <EmptyTab label="contacts" query={query} />
          ) : (
            results.contacts.map((c) => (
              <Link
                key={c.id}
                href={`/contacts/${c.id}`}
                className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-neutral-800/40"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-700 text-sm font-medium text-neutral-200">
                  {c.name[0]?.toUpperCase() ?? "?"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-neutral-100">
                    {c.name}
                  </span>
                  {(c.company || c.email) && (
                    <span className="block truncate text-xs text-neutral-500">
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
                className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-neutral-800/40"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-neutral-100">
                    {d.title}
                  </span>
                  <span className="block truncate text-xs capitalize text-neutral-500">
                    {d.stage}
                  </span>
                </span>
                {d.value && (
                  <span className="shrink-0 text-sm text-neutral-400">
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
                className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-neutral-800/40"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-neutral-100">
                    {a.subject}
                  </span>
                  {a.body && (
                    <span className="block truncate text-xs text-neutral-500">
                      {a.body}
                    </span>
                  )}
                </span>
                <span className="shrink-0 rounded px-1.5 py-0.5 text-xs font-medium capitalize bg-neutral-800 text-neutral-400">
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
    <p className="px-5 py-12 text-center text-sm text-neutral-500">
      No {label} match &ldquo;{query}&rdquo;.
    </p>
  );
}
