"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { searchGlobal, type SearchResults } from "@/app/(app)/search/actions";

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
}

type FlatItem =
  | { kind: "contact"; id: number; href: string }
  | { kind: "deal"; id: number; href: string }
  | { kind: "activity"; id: number; href: string }
  | { kind: "see-all"; category: "contacts" | "deals" | "activities"; href: string };

export function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Focus input on open; reset state on close
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 10);
      return () => clearTimeout(t);
    } else {
      setQuery("");
      setResults(null);
      setSelectedIndex(0);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults(null);
      setSelectedIndex(0);
      return;
    }
    const t = setTimeout(() => {
      startTransition(async () => {
        const res = await searchGlobal(query);
        setResults(res);
        setSelectedIndex(0);
      });
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  // Scroll selected item into view when selection changes via keyboard
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-search-idx="${selectedIndex}"]`
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const encodedQ = encodeURIComponent(query);

  // Flat list for keyboard navigation — order must match JSX rendering order
  const allItems: FlatItem[] = [];
  if (results) {
    for (const c of results.contacts) {
      allItems.push({ kind: "contact", id: c.id, href: `/contacts/${c.id}` });
    }
    if (results.totals.contacts > results.contacts.length) {
      allItems.push({
        kind: "see-all",
        category: "contacts",
        href: `/search?q=${encodedQ}&tab=contacts`,
      });
    }
    for (const d of results.deals) {
      allItems.push({ kind: "deal", id: d.id, href: `/deals/${d.id}` });
    }
    if (results.totals.deals > results.deals.length) {
      allItems.push({
        kind: "see-all",
        category: "deals",
        href: `/search?q=${encodedQ}&tab=deals`,
      });
    }
    for (const a of results.activities) {
      allItems.push({ kind: "activity", id: a.id, href: `/activity` });
    }
    if (results.totals.activities > results.activities.length) {
      allItems.push({
        kind: "see-all",
        category: "activities",
        href: `/search?q=${encodedQ}&tab=activities`,
      });
    }
  }

  function navigate(href: string) {
    router.push(href);
    onClose();
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case "Escape":
        onClose();
        break;
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, allItems.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        if (allItems[selectedIndex]) navigate(allItems[selectedIndex].href);
        break;
    }
  }

  if (!open) return null;

  // Index helpers — keep in sync with allItems construction above
  function idxForContact(id: number) {
    return allItems.findIndex((i) => i.kind === "contact" && i.id === id);
  }
  function idxForDeal(id: number) {
    return allItems.findIndex((i) => i.kind === "deal" && i.id === id);
  }
  function idxForActivity(id: number) {
    return allItems.findIndex((i) => i.kind === "activity" && i.id === id);
  }
  function idxForSeeAll(category: "contacts" | "deals" | "activities") {
    return allItems.findIndex((i) => i.kind === "see-all" && i.category === category);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="mx-4 w-full max-w-lg overflow-hidden rounded-xl border border-neutral-700 bg-neutral-900 shadow-2xl">
        {/* Input row */}
        <div className="flex items-center gap-3 border-b border-neutral-800 px-4 py-3">
          <svg
            className="shrink-0 text-neutral-500"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Search contacts, deals and activities…"
            className="flex-1 bg-transparent text-sm text-neutral-100 placeholder:text-neutral-500 outline-none"
          />
          {isPending && (
            <div className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          )}
          <kbd className="shrink-0 rounded border border-neutral-700 px-1.5 py-0.5 font-mono text-xs text-neutral-600">
            Esc
          </kbd>
        </div>

        {/* Results list */}
        <div ref={listRef} className="max-h-80 overflow-y-auto">
          {!results && (
            <p className="py-8 text-center text-sm text-neutral-500">
              Type to search contacts, deals and activities
            </p>
          )}

          {results && allItems.length === 0 && (
            <p className="py-8 text-center text-sm text-neutral-500">
              No results for &ldquo;{query}&rdquo;
            </p>
          )}

          {/* Contacts section */}
          {results && results.contacts.length > 0 && (
            <div className="p-2">
              <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Contacts
              </p>
              {results.contacts.map((contact) => {
                const flatIdx = idxForContact(contact.id);
                const active = flatIdx === selectedIndex;
                return (
                  <button
                    key={contact.id}
                    data-search-idx={flatIdx}
                    onClick={() => navigate(`/contacts/${contact.id}`)}
                    onMouseEnter={() => setSelectedIndex(flatIdx)}
                    className={[
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                      active
                        ? "bg-indigo-600 text-white"
                        : "text-neutral-200 hover:bg-neutral-800",
                    ].join(" ")}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-700 text-xs font-medium">
                      {contact.name[0]?.toUpperCase() ?? "?"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{contact.name}</span>
                      {(contact.company || contact.email) && (
                        <span
                          className={[
                            "block truncate text-xs",
                            active ? "text-indigo-200" : "text-neutral-500",
                          ].join(" ")}
                        >
                          {contact.company || contact.email}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
              {results.totals.contacts > results.contacts.length && (() => {
                const flatIdx = idxForSeeAll("contacts");
                const active = flatIdx === selectedIndex;
                return (
                  <button
                    data-search-idx={flatIdx}
                    onClick={() => navigate(`/search?q=${encodedQ}&tab=contacts`)}
                    onMouseEnter={() => setSelectedIndex(flatIdx)}
                    className={[
                      "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors",
                      active
                        ? "bg-indigo-600 text-indigo-100"
                        : "text-indigo-400 hover:bg-neutral-800",
                    ].join(" ")}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                    </svg>
                    See all {results.totals.contacts} contacts
                  </button>
                );
              })()}
            </div>
          )}

          {/* Deals section */}
          {results && results.deals.length > 0 && (
            <div className="p-2">
              <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Deals
              </p>
              {results.deals.map((deal) => {
                const flatIdx = idxForDeal(deal.id);
                const active = flatIdx === selectedIndex;
                return (
                  <button
                    key={deal.id}
                    data-search-idx={flatIdx}
                    onClick={() => navigate(`/deals/${deal.id}`)}
                    onMouseEnter={() => setSelectedIndex(flatIdx)}
                    className={[
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                      active
                        ? "bg-indigo-600 text-white"
                        : "text-neutral-200 hover:bg-neutral-800",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-neutral-400",
                        active ? "bg-indigo-500" : "bg-neutral-800",
                      ].join(" ")}
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="12" x2="12" y1="2" y2="22" />
                        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                      </svg>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{deal.title}</span>
                      <span
                        className={[
                          "block truncate text-xs capitalize",
                          active ? "text-indigo-200" : "text-neutral-500",
                        ].join(" ")}
                      >
                        {deal.stage}
                      </span>
                    </span>
                    {deal.value && (
                      <span
                        className={[
                          "shrink-0 text-xs",
                          active ? "text-indigo-200" : "text-neutral-400",
                        ].join(" ")}
                      >
                        ${Number(deal.value).toLocaleString()}
                      </span>
                    )}
                  </button>
                );
              })}
              {results.totals.deals > results.deals.length && (() => {
                const flatIdx = idxForSeeAll("deals");
                const active = flatIdx === selectedIndex;
                return (
                  <button
                    data-search-idx={flatIdx}
                    onClick={() => navigate(`/search?q=${encodedQ}&tab=deals`)}
                    onMouseEnter={() => setSelectedIndex(flatIdx)}
                    className={[
                      "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors",
                      active
                        ? "bg-indigo-600 text-indigo-100"
                        : "text-indigo-400 hover:bg-neutral-800",
                    ].join(" ")}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                    </svg>
                    See all {results.totals.deals} deals
                  </button>
                );
              })()}
            </div>
          )}

          {/* Activities section */}
          {results && results.activities.length > 0 && (
            <div className="p-2">
              <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Activities
              </p>
              {results.activities.map((activity) => {
                const flatIdx = idxForActivity(activity.id);
                const active = flatIdx === selectedIndex;
                return (
                  <button
                    key={activity.id}
                    data-search-idx={flatIdx}
                    onClick={() => navigate(`/activity`)}
                    onMouseEnter={() => setSelectedIndex(flatIdx)}
                    className={[
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                      active
                        ? "bg-indigo-600 text-white"
                        : "text-neutral-200 hover:bg-neutral-800",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-neutral-400",
                        active ? "bg-indigo-500" : "bg-neutral-800",
                      ].join(" ")}
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{activity.subject}</span>
                      {activity.body && (
                        <span
                          className={[
                            "block truncate text-xs",
                            active ? "text-indigo-200" : "text-neutral-500",
                          ].join(" ")}
                        >
                          {activity.body}
                        </span>
                      )}
                    </span>
                    <span
                      className={[
                        "shrink-0 rounded px-1.5 py-0.5 text-xs font-medium capitalize",
                        active
                          ? "bg-indigo-500 text-white"
                          : "bg-neutral-800 text-neutral-400",
                      ].join(" ")}
                    >
                      {activity.type}
                    </span>
                  </button>
                );
              })}
              {results.totals.activities > results.activities.length && (() => {
                const flatIdx = idxForSeeAll("activities");
                const active = flatIdx === selectedIndex;
                return (
                  <button
                    data-search-idx={flatIdx}
                    onClick={() => navigate(`/search?q=${encodedQ}&tab=activities`)}
                    onMouseEnter={() => setSelectedIndex(flatIdx)}
                    className={[
                      "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors",
                      active
                        ? "bg-indigo-600 text-indigo-100"
                        : "text-indigo-400 hover:bg-neutral-800",
                    ].join(" ")}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                    </svg>
                    See all {results.totals.activities} activities
                  </button>
                );
              })()}
            </div>
          )}
        </div>

        {/* Footer hints */}
        <div className="flex items-center justify-end gap-4 border-t border-neutral-800 px-4 py-2">
          <span className="text-xs text-neutral-600">
            <kbd className="mr-1 rounded border border-neutral-700 px-1 font-mono text-xs">↑↓</kbd>
            navigate
          </span>
          <span className="text-xs text-neutral-600">
            <kbd className="mr-1 rounded border border-neutral-700 px-1 font-mono text-xs">↵</kbd>
            select
          </span>
        </div>
      </div>
    </div>
  );
}
