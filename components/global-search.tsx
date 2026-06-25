"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { searchGlobal, type SearchResults } from "@/app/(app)/search/actions";
import { SearchIcon, DollarSignIcon, ClockIcon } from "@/components/icons";
import { useOverlayDismiss } from "@/hooks/use-overlay-dismiss";

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
  const panelRef = useOverlayDismiss<HTMLDivElement>(open, onClose);

  // Focus input on open; reset state on close
  useEffect(() => {
    if (open) {
      // ⌘K can fire over an open native <dialog>; never stack overlays.
      document
        .querySelectorAll("dialog[open]")
        .forEach((d) => (d as HTMLDialogElement).close());
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
      allItems.push({ kind: "see-all", category: "contacts", href: `/search?q=${encodedQ}&tab=contacts` });
    }
    for (const d of results.deals) {
      allItems.push({ kind: "deal", id: d.id, href: `/deals/${d.id}` });
    }
    if (results.totals.deals > results.deals.length) {
      allItems.push({ kind: "see-all", category: "deals", href: `/search?q=${encodedQ}&tab=deals` });
    }
    for (const a of results.activities) {
      allItems.push({ kind: "activity", id: a.id, href: `/activity` });
    }
    if (results.totals.activities > results.activities.length) {
      allItems.push({ kind: "see-all", category: "activities", href: `/search?q=${encodedQ}&tab=activities` });
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
    /* Backdrop — bottom-sheet on mobile, centered card on desktop */
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm sm:items-start sm:justify-center sm:pt-[15vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Global search"
        className="[color-scheme:dark] flex w-full flex-col max-h-[85dvh] overflow-hidden rounded-t-[--r-2xl] border border-[--line-1] bg-[--surface-1] shadow-[--shadow-3] sm:mx-4 sm:max-w-lg sm:rounded-[--r-xl]"
      >
        {/* Input row — 44px touch target */}
        <div className="tap flex items-center gap-3 border-b border-[--line-1] px-4">
          <SearchIcon size={16} className="shrink-0 text-[--ink-3]" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Search contacts, deals and activities…"
            className="flex-1 bg-transparent text-body text-[--ink-1] placeholder:text-[--ink-3] outline-none"
            aria-label="Global search"
          />
          {isPending && (
            <div className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[--accent] border-t-transparent" aria-hidden="true" />
          )}
          <kbd className="shrink-0 rounded border border-[--line-1] px-1.5 py-0.5 font-mono text-caption text-[--ink-3]">
            Esc
          </kbd>
        </div>

        {/* Results list — scrollable */}
        <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto" role="listbox" aria-label="Search results">
          {!results && (
            <p className="py-8 text-center text-body text-[--ink-3]">
              Type to search contacts, deals and activities
            </p>
          )}

          {results && allItems.length === 0 && (
            <p className="py-8 text-center text-body text-[--ink-3]">
              No results for &ldquo;{query}&rdquo;
            </p>
          )}

          {/* Contacts section */}
          {results && results.contacts.length > 0 && (
            <div className="p-2">
              <p className="mb-1 px-2 text-caption font-semibold uppercase tracking-wider text-[--ink-3]">
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
                    role="option"
                    aria-selected={active}
                    className={[
                      "tap flex w-full items-center gap-3 rounded-[--r-md] px-3 text-left text-body transition-colors",
                      active
                        ? "bg-[--accent] text-[--accent-ink]"
                        : "text-[--ink-1] hover:bg-[--surface-2]",
                    ].join(" ")}
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[--surface-2] text-footnote font-medium">
                      {contact.name[0]?.toUpperCase() ?? "?"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{contact.name}</span>
                      {(contact.company || contact.email) && (
                        <span className={["block truncate text-footnote", active ? "opacity-70" : "text-[--ink-3]"].join(" ")}>
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
                    role="option"
                    aria-selected={active}
                    className={[
                      "tap flex w-full items-center gap-2 rounded-[--r-md] px-3 text-left text-footnote transition-colors",
                      active ? "bg-[--accent] text-[--accent-ink]" : "text-[--accent] hover:bg-[--surface-2]",
                    ].join(" ")}
                  >
                    <SearchIcon size={12} className="shrink-0" aria-hidden="true" />
                    See all {results.totals.contacts} contacts
                  </button>
                );
              })()}
            </div>
          )}

          {/* Deals section */}
          {results && results.deals.length > 0 && (
            <div className="p-2">
              <p className="mb-1 px-2 text-caption font-semibold uppercase tracking-wider text-[--ink-3]">
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
                    role="option"
                    aria-selected={active}
                    className={[
                      "tap flex w-full items-center gap-3 rounded-[--r-md] px-3 text-left text-body transition-colors",
                      active ? "bg-[--accent] text-[--accent-ink]" : "text-[--ink-1] hover:bg-[--surface-2]",
                    ].join(" ")}
                  >
                    <span className={["flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[--ink-2]", active ? "bg-[--accent-hover]" : "bg-[--surface-2]"].join(" ")}>
                      <DollarSignIcon size={12} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{deal.title}</span>
                      <span className={["block truncate text-footnote capitalize", active ? "opacity-70" : "text-[--ink-3]"].join(" ")}>
                        {deal.stage}
                      </span>
                    </span>
                    {deal.value && (
                      <span className={["shrink-0 text-footnote", active ? "opacity-80" : "text-[--ink-2]"].join(" ")}>
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
                    role="option"
                    aria-selected={active}
                    className={[
                      "tap flex w-full items-center gap-2 rounded-[--r-md] px-3 text-left text-footnote transition-colors",
                      active ? "bg-[--accent] text-[--accent-ink]" : "text-[--accent] hover:bg-[--surface-2]",
                    ].join(" ")}
                  >
                    <SearchIcon size={12} className="shrink-0" aria-hidden="true" />
                    See all {results.totals.deals} deals
                  </button>
                );
              })()}
            </div>
          )}

          {/* Activities section */}
          {results && results.activities.length > 0 && (
            <div className="p-2">
              <p className="mb-1 px-2 text-caption font-semibold uppercase tracking-wider text-[--ink-3]">
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
                    role="option"
                    aria-selected={active}
                    className={[
                      "tap flex w-full items-center gap-3 rounded-[--r-md] px-3 text-left text-body transition-colors",
                      active ? "bg-[--accent] text-[--accent-ink]" : "text-[--ink-1] hover:bg-[--surface-2]",
                    ].join(" ")}
                  >
                    <span className={["flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[--ink-2]", active ? "bg-[--accent-hover]" : "bg-[--surface-2]"].join(" ")}>
                      <ClockIcon size={12} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{activity.subject}</span>
                      {activity.body && (
                        <span className={["block truncate text-footnote", active ? "opacity-70" : "text-[--ink-3]"].join(" ")}>
                          {activity.body}
                        </span>
                      )}
                    </span>
                    <span className={["shrink-0 rounded-[--r-sm] px-1.5 py-0.5 text-caption font-medium capitalize", active ? "bg-[--accent-hover] text-[--accent-ink]" : "bg-[--surface-3] text-[--ink-2]"].join(" ")}>
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
                    role="option"
                    aria-selected={active}
                    className={[
                      "tap flex w-full items-center gap-2 rounded-[--r-md] px-3 text-left text-footnote transition-colors",
                      active ? "bg-[--accent] text-[--accent-ink]" : "text-[--accent] hover:bg-[--surface-2]",
                    ].join(" ")}
                  >
                    <SearchIcon size={12} className="shrink-0" aria-hidden="true" />
                    See all {results.totals.activities} activities
                  </button>
                );
              })()}
            </div>
          )}
        </div>

        {/* Footer hints */}
        <div
          className="flex items-center justify-end gap-4 border-t border-[--line-1] px-4 py-2"
          style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}
        >
          <span className="text-caption text-[--ink-3]">
            <kbd className="mr-1 rounded border border-[--line-1] px-1 font-mono text-caption">↑↓</kbd>
            navigate
          </span>
          <span className="text-caption text-[--ink-3]">
            <kbd className="mr-1 rounded border border-[--line-1] px-1 font-mono text-caption">↵</kbd>
            select
          </span>
        </div>
      </div>
    </div>
  );
}
